from datetime import datetime

from pydantic import BaseModel


class CommentCreate(BaseModel):
    mark_id: str
    body: str
    parent_id: int | None = None


class CommentUpdate(BaseModel):
    body: str | None = None
    resolved: bool | None = None


class CommentOut(BaseModel):
    id: int
    document_id: int
    mark_id: str
    author_id: int
    author_name: str
    parent_id: int | None
    body: str
    resolved: bool
    created_at: datetime
    updated_at: datetime
