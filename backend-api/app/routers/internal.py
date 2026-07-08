import hmac

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import decode_token
from app.cerbos.client import cerbos
from app.config import settings
from app.db import get_db
from app.models.document import Document
from app.models.permission import Permission
from app.models.user import User

router = APIRouter(prefix="/api/internal", tags=["internal"])


class AuthorizeRequest(BaseModel):
    token: str
    documentName: str
    action: str = "view"


class AuthorizeResponse(BaseModel):
    allowed: bool
    userId: str | None = None
    roles: list[str] = []


def _require_internal_key(
    x_internal_key: str | None = Header(default=None, alias="X-Internal-Key"),
) -> None:
    # chamada servico-a-servico (Hocuspocus -> FastAPI). Nao e o JWT do usuario.
    if not x_internal_key or not hmac.compare_digest(x_internal_key, settings.INTERNAL_API_KEY):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="internal key invalida")


@router.post("/authorize", response_model=AuthorizeResponse)
async def authorize(
    payload: AuthorizeRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_internal_key),
):
    """Usado pelo onAuthenticate do Hocuspocus: valida JWT + Cerbos antes do WS."""
    try:
        claims = decode_token(payload.token)
        uid = int(claims["sub"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token invalido")

    user = await db.get(User, uid)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="usuario invalido")

    # convencao: documentName == id do Document
    try:
        doc_id = int(payload.documentName)
    except (TypeError, ValueError):
        return AuthorizeResponse(allowed=False, userId=str(uid))

    doc = await db.get(Document, doc_id)
    if doc is None:
        return AuthorizeResponse(allowed=False, userId=str(uid))

    roles = {user.role}
    rows = await db.execute(
        select(Permission.role).where(
            Permission.user_id == user.id,
            Permission.document_id == doc.id,
        )
    )
    roles.update(r for (r,) in rows.all())
    role_list = sorted(roles)

    allowed = await cerbos.is_allowed(
        principal_id=str(user.id),
        roles=role_list,
        action=payload.action,
        resource_kind="document",
        resource_id=str(doc.id),
        resource_attr={"ownerId": str(doc.owner_id)},
    )
    return AuthorizeResponse(allowed=allowed, userId=str(uid), roles=role_list)
