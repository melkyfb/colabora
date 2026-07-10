import asyncio
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.cerbos.client import cerbos
from app.db import get_db
from app.models.document import Document
from app.models.user import User
from app.rag.ingest import pdf_to_text, split_text
from app.rag.llm import get_llm
from app.rag.vectorstore import add_chunks, search
from app.routers.documents import _authorize, _get_or_404

router = APIRouter(prefix="/api/rag", tags=["rag"])


# ── Ingest ──────────────────────────────────────────────────────────────────
class IngestResponse(BaseModel):
    documentId: int
    chunks: int


@router.post("/documents/{doc_id}/ingest", response_model=IngestResponse)
async def ingest(
    doc_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = await _get_or_404(db, doc_id)
    await _authorize(db, user, doc, "edit")  # so quem pode editar o doc pode ingerir

    raw = await file.read()
    is_pdf = file.content_type == "application/pdf" or (file.filename or "").lower().endswith(".pdf")
    text = pdf_to_text(raw) if is_pdf else raw.decode("utf-8", errors="ignore")

    chunks = split_text(text)
    if not chunks:
        raise HTTPException(status_code=400, detail="Documento vazio / sem texto extraivel")

    metadatas = [
        {"document_id": str(doc.id), "owner_id": str(doc.owner_id), "chunk_index": i}
        for i in range(len(chunks))
    ]
    # embedding (CPU) + OpenSearch sao sincronos -> threadpool, senao travam o event loop
    await asyncio.to_thread(add_chunks, chunks, metadatas)
    return IngestResponse(documentId=doc.id, chunks=len(chunks))


# ── Recuperacao (K-NN + filtro Cerbos), compartilhada por /search e /chat ─────
class SearchHit(BaseModel):
    documentId: str
    title: str | None = None
    chunkIndex: int | None = None
    score: float
    text: str


class ChatDocument(BaseModel):
    id: int
    title: str
    updatedAt: datetime


async def _retrieve_allowed(
    db: AsyncSession, user: User, query: str, k: int
) -> tuple[list[SearchHit], list[ChatDocument]]:
    raw_k = max(k * 4, 20)  # over-fetch p/ sobrar apos filtro
    results = await asyncio.to_thread(search, query, raw_k)  # embed da query e sincrono
    if not results:
        return [], []

    resources: dict[str, dict] = {}
    for doc, _score in results:
        did = str(doc.metadata.get("document_id"))
        if did and did not in resources:
            resources[did] = {"id": did, "attr": {"ownerId": str(doc.metadata.get("owner_id", ""))}}

    # ponytail: filtro usa role GLOBAL (+ owner ABAC); grants por-doc nao entram na busca.
    allowed = await cerbos.allowed_resource_ids(
        principal_id=str(user.id),
        roles=[user.role],
        action="view",
        resource_kind="document",
        resources=list(resources.values()),
    )

    # titulos/datas dos docs permitidos (MySQL) — alimenta hits e a lista "Abrir"
    id_map: dict[str, Document] = {}
    int_ids = [int(i) for i in allowed if str(i).isdigit()]
    if int_ids:
        rows = await db.execute(select(Document).where(Document.id.in_(int_ids)))
        id_map = {str(d.id): d for d in rows.scalars().all()}

    hits: list[SearchHit] = []
    for doc, score in results:
        did = str(doc.metadata.get("document_id"))
        if did in allowed:
            meta = id_map.get(did)
            hits.append(
                SearchHit(
                    documentId=did,
                    title=meta.title if meta else None,
                    chunkIndex=doc.metadata.get("chunk_index"),
                    score=float(score),
                    text=doc.page_content,
                )
            )
        if len(hits) >= k:
            break

    # lista dedupada de documentos (na ordem de relevancia) p/ o botao "Abrir"
    documents: list[ChatDocument] = []
    seen: set[str] = set()
    for h in hits:
        if h.documentId in seen:
            continue
        seen.add(h.documentId)
        meta = id_map.get(h.documentId)
        if meta is not None:
            documents.append(
                ChatDocument(id=meta.id, title=meta.title, updatedAt=meta.updated_at)
            )
    return hits, documents


# ── Search (retorna os chunks crus) ──────────────────────────────────────────
class SearchRequest(BaseModel):
    query: str
    k: int = 5


@router.post("/search", response_model=list[SearchHit])
async def rag_search(
    payload: SearchRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hits, _ = await _retrieve_allowed(db, user, payload.query, payload.k)
    return hits


# ── Chat generativo (RAG -> LLM configuravel) ────────────────────────────────
class ChatRequest(BaseModel):
    query: str
    k: int = 5


class ChatResponse(BaseModel):
    answer: str
    sources: list[SearchHit]
    documents: list[ChatDocument] = []


_SYSTEM = (
    "Voce e o Assistente Nyx, de uma plataforma de gestao de dados aeroespaciais. "
    "Responda em portugues usando SOMENTE o contexto fornecido. Se a resposta nao "
    "estiver no contexto, diga que nao sabe. Cite as fontes como [doc N]. "
    "Se o usuario pedir para encontrar ou abrir um documento, aponte os titulos "
    "relevantes do contexto e diga que ele pode abrir pela lista de documentos."
)


@router.post("/chat", response_model=ChatResponse)
async def rag_chat(
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hits, documents = await _retrieve_allowed(db, user, payload.query, payload.k)
    if not hits:
        return ChatResponse(
            answer="Nao encontrei nada relevante e autorizado pra responder.", sources=[]
        )

    context = "\n\n".join(
        f"[doc {h.documentId} '{h.title or 'sem titulo'}' #{h.chunkIndex}] {h.text}" for h in hits
    )
    human = f"Contexto:\n{context}\n\nPergunta: {payload.query}"

    llm = get_llm()
    resp = await llm.ainvoke([SystemMessage(content=_SYSTEM), HumanMessage(content=human)])
    answer = resp.content if isinstance(resp.content, str) else str(resp.content)
    return ChatResponse(answer=answer, sources=hits, documents=documents)
