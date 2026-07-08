from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # papel global default. Papeis por-documento vem da tabela permissions.
    role: Mapped[str] = mapped_column(String(50), default="engineer_l1", server_default="engineer_l1")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
