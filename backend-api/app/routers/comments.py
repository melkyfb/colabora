from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.db import get_db
from app.models.comment import Comment
from app.models.document import Document
from app.models.user import User
from app.routers.documents import _authorize, _get_or_404
from app.schemas.comment import CommentCreate, CommentOut, CommentUpdate

router = APIRouter(prefix="/api", tags=["comments"])


def _to_out(c: Comment, author_name: str | None, author_email: str) -> CommentOut:
    return CommentOut(
        id=c.id,
        document_id=c.document_id,
        mark_id=c.mark_id,
        author_id=c.author_id,
        author_name=author_name or author_email,
        parent_id=c.parent_id,
        body=c.body,
        resolved=c.resolved,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


async def _comment_or_404(db: AsyncSession, comment_id: int) -> Comment:
    c = await db.get(Comment, comment_id)
    if c is None:
        raise HTTPException(status_code=404, detail="Comentario nao encontrado")
    return c


async def _author_or_editor(db: AsyncSession, user: User, c: Comment) -> None:
    # autor do comentario sempre pode; senao precisa de "edit" no doc (Cerbos)
    if user.id == c.author_id:
        return
    doc = await db.get(Document, c.document_id)
    await _authorize(db, user, doc, "edit")


@router.get("/documents/{doc_id}/comments", response_model=list[CommentOut])
async def list_comments(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = await _get_or_404(db, doc_id)
    await _authorize(db, user, doc, "view")
    rows = await db.execute(
        select(Comment, User.full_name, User.email)
        .join(User, User.id == Comment.author_id)
        .where(Comment.document_id == doc_id)
        .order_by(Comment.created_at)
    )
    return [_to_out(c, name, email) for c, name, email in rows.all()]


@router.post(
    "/documents/{doc_id}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    doc_id: int,
    payload: CommentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = await _get_or_404(db, doc_id)
    await _authorize(db, user, doc, "edit")
    if payload.parent_id is not None:
        parent = await db.get(Comment, payload.parent_id)
        if parent is None or parent.document_id != doc_id:
            raise HTTPException(status_code=404, detail="Comentario pai nao encontrado")
    c = Comment(
        document_id=doc_id,
        mark_id=payload.mark_id,
        author_id=user.id,
        parent_id=payload.parent_id,
        body=payload.body,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return _to_out(c, user.full_name, user.email)


@router.patch("/comments/{comment_id}", response_model=CommentOut)
async def update_comment(
    comment_id: int,
    payload: CommentUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    c = await _comment_or_404(db, comment_id)
    await _author_or_editor(db, user, c)
    if payload.body is not None:
        c.body = payload.body
    if payload.resolved is not None:
        c.resolved = payload.resolved
    await db.commit()
    await db.refresh(c)
    author = await db.get(User, c.author_id)
    return _to_out(c, author.full_name if author else None, author.email if author else "?")


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    c = await _comment_or_404(db, comment_id)
    await _author_or_editor(db, user, c)
    await db.delete(c)
    await db.commit()
