from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentCreate(BaseModel):
    title: str
    content: str | None = None


class DocumentUpdate(BaseModel):
    title: str | None = None
    content: str | None = None


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    owner_id: int
    content: str | None
    created_at: datetime
    updated_at: datetime
