"""Self-check das rotinas de auth. Roda sem DB/infra: pytest -q."""

from app.auth.security import (
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_password_roundtrip():
    h = hash_password("s3cret-pw")
    assert verify_password("s3cret-pw", h)
    assert not verify_password("wrong", h)


def test_jwt_roundtrip():
    token = create_access_token(sub="42")
    assert decode_token(token)["sub"] == "42"
