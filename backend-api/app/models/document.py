from sqlalchemy import ForeignKey, String, Text, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Document(Base, TimestampMixin):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255))
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    binary_state: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
