import asyncio

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.db import get_db
from app.models.user import User
from app.rag.ingest import split_text
from app.rag.vectorstore import add_chunks
from app.routers.documents import _authorize, _get_or_404
from app.services.convert import docx_to_html, html_to_text, pdf_to_html

router = APIRouter(prefix="/api/documents", tags=["imports"])

MAX_SIZE = 20 * 1024 * 1024  # 20MB (spec)


@router.post("/{doc_id}/convert")
async def convert_document(
    doc_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = await _get_or_404(db, doc_id)
    await _authorize(db, user, doc, "edit")

    name = (file.filename or "").lower()
    if name.endswith(".docx"):
        convert = docx_to_html
    elif name.endswith(".pdf"):
        convert = pdf_to_html
    else:
        raise HTTPException(status_code=415, detail="Formato nao suportado (so .pdf e .docx)")

    raw = await file.read()
    if len(raw) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="Arquivo maior que 20MB")

    # conversao e CPU-bound -> threadpool, mesmo padrao do ingest do RAG.
    # bytes corrompidos com extensao valida fazem pymupdf/mammoth levantarem —
    # contrato do spec e 4xx limpo, nao 500.
    try:
        html = await asyncio.to_thread(convert, raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Arquivo corrompido ou ilegivel")
    text = html_to_text(html)
    if not text:
        raise HTTPException(status_code=400, detail="Documento sem texto extraivel")

    chunks = split_text(text)
    metadatas = [
        {"document_id": str(doc.id), "owner_id": str(doc.owner_id), "chunk_index": i}
        for i in range(len(chunks))
    ]
    await asyncio.to_thread(add_chunks, chunks, metadatas)

    # fallback: se o cliente morrer antes do setContent, o seeder do Hocuspocus
    # (onLoadDocument) ainda entrega o texto como paragrafos editaveis.
    doc.content = text
    await db.commit()

    return {"html": html, "chunks": len(chunks)}
