from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.cerbos.client import cerbos
from app.db import get_db
from app.models.document import Document
from app.models.permission import Permission
from app.models.user import User
from app.schemas.document import DocumentCreate, DocumentOut, DocumentUpdate

router = APIRouter(prefix="/api/documents", tags=["documents"])


async def _roles_for(db: AsyncSession, user: User, doc: Document) -> list[str]:
    roles = {user.role}
    rows = await db.execute(
        select(Permission.role).where(
            Permission.user_id == user.id,
            Permission.document_id == doc.id,
        )
    )
    roles.update(r for (r,) in rows.all())
    return sorted(roles)


async def _can(db: AsyncSession, user: User, doc: Document, action: str) -> bool:
    return await cerbos.is_allowed(
        principal_id=str(user.id),
        roles=await _roles_for(db, user, doc),
        action=action,
        resource_kind="document",
        resource_id=str(doc.id),
        resource_attr={"ownerId": str(doc.owner_id)},
    )


async def _authorize(db: AsyncSession, user: User, doc: Document, action: str) -> None:
    if not await _can(db, user, doc, action):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Cerbos negou acao '{action}'",
        )


async def _get_or_404(db: AsyncSession, doc_id: int) -> Document:
    doc = await db.get(Document, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Documento nao encontrado")
    return doc


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def create_document(
    payload: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # criar doc proprio: qualquer usuario autenticado vira owner.
    doc = Document(title=payload.title, content=payload.content, owner_id=user.id)
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return DocumentOut.model_validate(doc).model_copy(update={"can_edit": True})


@router.get("/{doc_id}", response_model=DocumentOut)
async def get_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = await _get_or_404(db, doc_id)
    await _authorize(db, user, doc, "view")
    out = DocumentOut.model_validate(doc)
    return out.model_copy(update={"can_edit": await _can(db, user, doc, "edit")})


@router.get("/{doc_id}/state")
async def get_document_state(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Estado binario Y.js do doc, pro Hocuspocus hidratar (onLoadDocument)."""
    doc = await _get_or_404(db, doc_id)
    await _authorize(db, user, doc, "view")
    return Response(content=doc.binary_state or b"", media_type="application/octet-stream")


@router.put("/{doc_id}", response_model=DocumentOut)
async def update_document(
    doc_id: int,
    payload: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = await _get_or_404(db, doc_id)
    await _authorize(db, user, doc, "edit")
    if payload.title is not None:
        doc.title = payload.title
    if payload.content is not None:
        doc.content = payload.content
    await db.commit()
    await db.refresh(doc)
    return DocumentOut.model_validate(doc).model_copy(update={"can_edit": True})


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = await _get_or_404(db, doc_id)
    await _authorize(db, user, doc, "delete")
    await db.delete(doc)
    await db.commit()
