from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import settings


def hash_password(plain: str) -> str:
    # ponytail: bcrypt trunca em 72 bytes. OK p/ PoC; se senhas longas importarem, pre-hash SHA-256.
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def _create_token(sub: str, expires_delta: timedelta, token_type: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "iat": now,
        "exp": now + expires_delta,
        "type": token_type,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_access_token(sub: str) -> str:
    return _create_token(sub, timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES), "access")


def create_refresh_token(sub: str) -> str:
    return _create_token(sub, timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS), "refresh")


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
