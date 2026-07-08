import hashlib
import hmac
import json

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models.document import Document

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


def _verify_signature(body: bytes, signature: str | None) -> None:
    # @hocuspocus/extension-webhook assina o body com HMAC-SHA256 e envia no header.
    if not signature:
        raise HTTPException(status_code=401, detail="Assinatura ausente")
    expected = "sha256=" + hmac.new(
        settings.HOCUSPOCUS_WEBHOOK_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Assinatura invalida")


@router.post("/hocuspocus", status_code=status.HTTP_200_OK)
async def hocuspocus_webhook(
    request: Request,
    x_signature: str | None = Header(default=None, alias="X-Hocuspocus-Signature-256"),
    db: AsyncSession = Depends(get_db),
):
    raw = await request.body()
    _verify_signature(raw, x_signature)

    data = json.loads(raw)
    event = data.get("event")
    payload = data.get("payload", {})

    if event not in ("onStoreDocument", "onChange"):
        return {"status": "ignored", "event": event}

    # convencao: documentName == id do Document no MySQL.
    name = payload.get("documentName")
    try:
        doc_id = int(name)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="documentName invalido")

    doc = await db.get(Document, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Documento nao encontrado")

    # ponytail: Fase 3 define a extracao do texto do estado Y.js no lado Node e
    # envia em payload["document"]. Aqui apenas persistimos o que chegar.
    content = payload.get("document")
    if content is not None:
        doc.content = content if isinstance(content, str) else json.dumps(content)
        await db.commit()

    return {"status": "stored", "documentId": doc_id}
