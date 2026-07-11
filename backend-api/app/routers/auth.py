import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.auth.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db import get_db
from app.models.user import User
from app.schemas.auth import RefreshRequest, Token, UserCreate, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    exists = await db.scalar(select(User).where(User.email == payload.email))
    if exists:
        raise HTTPException(status_code=409, detail="Email ja cadastrado")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role or "engineer_l1",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    # OAuth2 usa "username"; aqui o username e o email.
    user = await db.scalar(select(User).where(User.email == form.username))
    if user is None or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais invalidas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return Token(
        access_token=create_access_token(sub=str(user.id)),
        refresh_token=create_refresh_token(sub=str(user.id)),
    )


@router.post("/refresh", response_model=Token)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    cred_exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalido")
    try:
        claims = decode_token(payload.refresh_token)
        if claims.get("type") != "refresh":
            raise cred_exc
        uid = int(claims["sub"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        raise cred_exc

    user = await db.get(User, uid)
    if user is None or not user.is_active:
        raise cred_exc

    # ponytail: rotaciona o refresh token mas nao revoga o anterior (stateless,
    # sem blacklist). Aceitavel pro PoC; se precisar de revogacao real, precisa
    # de uma tabela de tokens emitidos.
    return Token(
        access_token=create_access_token(sub=str(user.id)),
        refresh_token=create_refresh_token(sub=str(user.id)),
    )


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user
