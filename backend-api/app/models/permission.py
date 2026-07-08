from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Permission(Base, TimestampMixin):
    __tablename__ = "permissions"
    __table_args__ = (
        UniqueConstraint("user_id", "document_id", name="uq_user_document"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    document_id: Mapped[int] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    # engineer_l1 | engineer_lead | admin  (papel do usuario NAQUELE documento)
    role: Mapped[str] = mapped_column(String(50))
