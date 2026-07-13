# Conversão de Documentos (PDF/DOCX → editável) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar PDF/DOCX como conteúdo editável no editor Tiptap (dois fluxos: header cria doc novo; toolbar insere no cursor), com indexação automática no RAG.

**Architecture:** Backend converte arquivo → HTML (`mammoth` pra DOCX, `pymupdf` com heurísticas pra PDF) num endpoint único que também ingere os chunks no RAG e salva texto-plano como fallback; o frontend injeta o HTML no editor conectado (`setContent`/`insertContent`) e o Y.js/Hocuspocus persiste sozinho. Zero mudança no realtime-server.

**Tech Stack:** FastAPI + mammoth + PyMuPDF (backend), React + TS + Tiptap v2 (frontend), OpenSearch (RAG), MySQL.

## Global Constraints

- Formatos aceitos: SOMENTE `.pdf` e `.docx` → 415 para o resto. Limite 20MB → 413. Sem texto extraível → 400.
- Novas deps backend: `mammoth>=1.6` e `pymupdf>=1.24` no `pyproject.toml`. O Dockerfile instala deps do pyproject NO BUILD → toda task backend que mexe em deps exige `docker compose build backend-api && docker compose up -d backend-api`. Código (bind-mounted) só exige `docker restart nyx-backend-api`.
- Backend não tem hot-reload: `docker restart nyx-backend-api && sleep 6` após editar código antes de testar.
- Endpoint: `POST /api/documents/{doc_id}/convert`, autz `edit` via `_authorize` importado de `app.routers.documents` (mesmo padrão do router de comentários). Retorno: `{"html": str, "chunks": int}`.
- PDF: heurísticas — heading por tamanho de fonte ≥1.25×/1.4×/1.6× a mediana (h3/h2/h1), bold pela flag 16 do span, listas por prefixo `•·▪‣-*` ou `1.`/`1)`. SEM tabelas nem imagens de PDF.
- DOCX: mammoth com comportamento default (imagens já viram data-URI inline — casa com o editor).
- RAG: chunks via `split_text` + `add_chunks` existentes (`app.rag.ingest`/`app.rag.vectorstore`), metadados `{"document_id", "owner_id", "chunk_index"}` idênticos ao `/ingest` atual, chamada em `asyncio.to_thread`.
- `doc.content` = texto plano salvo no convert (fallback do seeder do Hocuspocus).
- Frontend: `authedFetch` para o multipart (NÃO setar Content-Type manualmente — o browser define o boundary). Labels em português. Tiptap core intocado (`^2.11.0`); NENHUM pacote npm novo.
- Fluxo header: falha na conversão → apagar o doc recém-criado (DELETE) e mostrar o erro; sem docs órfãos. Botão do header disponível pra todos (criador = owner). Botão da toolbar desabilitado sem `can_edit`.
- Fluxo header: injetar o HTML só DEPOIS do evento `synced` do HocuspocusProvider (não colidir com o seed do onLoadDocument); `setContent` substitui o conteúdo semeado.
- Verificação frontend: container docker em `http://localhost:5173` (bind-mount + HMR), backend `http://localhost:8000`. Sem Vite local em outra porta (CORS).
- Backend sem framework de teste; verificação por script-com-asserts dentro do container + curl real com saída OBSERVADA colada no report (nunca "esperado").
- `cd frontend && npm run typecheck` limpo em toda task frontend.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `backend-api/pyproject.toml` | (mod, Task 1) + mammoth, pymupdf |
| `backend-api/app/services/convert.py` | (novo, Task 1) docx_to_html, pdf_to_html, html_to_text |
| `backend-api/app/services/__init__.py` | (novo, Task 1) vazio (pacote) |
| `backend-api/app/routers/imports.py` | (novo, Task 2) endpoint POST /{doc_id}/convert |
| `backend-api/app/main.py` | (mod, Task 2) registrar router |
| `frontend/src/api.ts` | (mod, Task 3) convertDocument + deleteDocument |
| `frontend/src/App.tsx` | (mod, Task 3) botão Importar doc + pendingImport + delete-on-fail |
| `frontend/src/Editor.tsx` | (mod, Tasks 3-4) gating synced + injeção setContent; token/handler pro toolbar-import |
| `frontend/src/Toolbar.tsx` | (mod, Task 4) botão 📥 + file input próprio |

---

### Task 1: Backend — deps + módulo de conversão

**Files:**
- Modify: `backend-api/pyproject.toml` (bloco dependencies)
- Create: `backend-api/app/services/__init__.py`
- Create: `backend-api/app/services/convert.py`

**Interfaces:**
- Consumes: nada do projeto (stdlib + mammoth + fitz).
- Produces (Task 2 depende): `docx_to_html(raw: bytes) -> str`, `pdf_to_html(raw: bytes) -> str`, `html_to_text(html_str: str) -> str` em `app.services.convert`.

- [ ] **Step 1: Adicionar deps ao pyproject.toml**

Em `backend-api/pyproject.toml`, dentro de `dependencies = [...]`, após a linha `"pypdf>=4.0",`:

```toml
    "mammoth>=1.6",              # DOCX -> HTML semantico (conversao de documentos)
    "pymupdf>=1.24",             # PDF -> HTML com heuristicas (conversao de documentos)
```

- [ ] **Step 2: Criar o pacote services**

Criar `backend-api/app/services/__init__.py` vazio (0 bytes, só pra ser pacote).

- [ ] **Step 3: Criar convert.py**

Criar `backend-api/app/services/convert.py`:

```python
"""Conversao de documentos (PDF/DOCX) para HTML compativel com o schema Tiptap.

DOCX: mammoth (default ja embute imagens como data-URI).
PDF: pymupdf com heuristicas declaradas de melhor-esforco (spec 2026-07-13):
heading por tamanho de fonte vs mediana, bold pela flag do span, listas por
prefixo de marcador. Sem tabelas nem imagens de PDF (v1).
"""
import html as html_mod
import io
import re
import statistics

import fitz  # pymupdf
import mammoth

# flag 16 = bold na fontflag do span do pymupdf
_BOLD_FLAG = 16
_BULLET_RE = re.compile(r"^\s*([•·▪‣\-\*]|\d+[.)])\s+")
_ORDERED_RE = re.compile(r"^\s*\d+[.)]\s+")


def docx_to_html(raw: bytes) -> str:
    # warnings do mammoth ignorados de proposito (best-effort, spec)
    return mammoth.convert_to_html(io.BytesIO(raw)).value


def pdf_to_html(raw: bytes) -> str:
    doc = fitz.open(stream=raw, filetype="pdf")

    # 1a passada: mediana dos tamanhos de fonte do documento inteiro
    sizes: list[float] = []
    pages_blocks: list[list[dict]] = []
    for page in doc:
        blocks = page.get_text("dict")["blocks"]
        pages_blocks.append(blocks)
        for block in blocks:
            for line in block.get("lines", []):
                for span in line["spans"]:
                    if span["text"].strip():
                        sizes.append(span["size"])
    if not sizes:
        return ""
    median = statistics.median(sizes)

    out: list[str] = []
    open_list: str | None = None  # "ul" | "ol"

    def close_list() -> None:
        nonlocal open_list
        if open_list:
            out.append(f"</{open_list}>")
            open_list = None

    for blocks in pages_blocks:
        for block in blocks:
            lines = block.get("lines", [])
            if not lines:
                continue
            parts: list[str] = []
            max_size = 0.0
            for line in lines:
                line_parts: list[str] = []
                for span in line["spans"]:
                    t = span["text"]
                    if not t.strip():
                        continue
                    max_size = max(max_size, span["size"])
                    esc = html_mod.escape(t)
                    if span["flags"] & _BOLD_FLAG:
                        esc = f"<strong>{esc}</strong>"
                    line_parts.append(esc)
                if line_parts:
                    parts.append("".join(line_parts))
            text = " ".join(parts).strip()
            if not text:
                continue

            # texto sem tags pra decidir lista (o escape nao muda os prefixos)
            plain = re.sub(r"</?strong>", "", text)

            if max_size >= median * 1.6:
                close_list()
                out.append(f"<h1>{text}</h1>")
            elif max_size >= median * 1.4:
                close_list()
                out.append(f"<h2>{text}</h2>")
            elif max_size >= median * 1.25:
                close_list()
                out.append(f"<h3>{text}</h3>")
            elif _BULLET_RE.match(plain):
                kind = "ol" if _ORDERED_RE.match(plain) else "ul"
                if open_list != kind:
                    close_list()
                    out.append(f"<{kind}>")
                    open_list = kind
                item = _BULLET_RE.sub("", text, count=1)
                out.append(f"<li><p>{item}</p></li>")
            else:
                close_list()
                out.append(f"<p>{text}</p>")
        close_list()

    return "".join(out)


_TAG_RE = re.compile(r"<[^>]+>")
_BLOCK_END_RE = re.compile(r"</(p|h[1-6]|li|tr|div)>|<br\s*/?>", re.I)


def html_to_text(html_str: str) -> str:
    """Strip de tags pros chunks do RAG e pro fallback de Document.content."""
    with_breaks = _BLOCK_END_RE.sub("\n", html_str)
    text = _TAG_RE.sub("", with_breaks)
    return html_mod.unescape(text).strip()
```

- [ ] **Step 4: Rebuild da imagem (deps novas)**

```bash
docker compose build backend-api && docker compose up -d backend-api && sleep 8
docker exec nyx-backend-api python -c "import mammoth, fitz; print('deps ok')"
```

Esperado: `deps ok`.

- [ ] **Step 5: Verificação com asserts (fixtures gerados no container)**

O container tem pymupdf — ele mesmo gera o PDF de teste. O DOCX de teste é um
zip mínimo montado com stdlib. Rodar:

```bash
docker exec nyx-backend-api python - <<'EOF'
import io, zipfile

# ── fixture DOCX minimo (docx = zip de XML) com heading, bold, lista, tabela ──
DOC_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Titulo Um</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">Texto normal com </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>negrito</w:t></w:r><w:r><w:t>.</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>item um</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>item dois</w:t></w:r></w:p>
<w:tbl><w:tr><w:tc><w:p><w:r><w:t>celula A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>celula B</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
</w:body></w:document>"""

NUMBERING_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>"""

CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>"""

RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

DOC_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>"""

buf = io.BytesIO()
with zipfile.ZipFile(buf, "w") as z:
    z.writestr("[Content_Types].xml", CONTENT_TYPES)
    z.writestr("_rels/.rels", RELS)
    z.writestr("word/_rels/document.xml.rels", DOC_RELS)
    z.writestr("word/document.xml", DOC_XML)
    z.writestr("word/numbering.xml", NUMBERING_XML)
docx_bytes = buf.getvalue()
open("/tmp/fixture.docx", "wb").write(docx_bytes)

# ── fixture PDF com fontes de tamanhos distintos ──
import fitz
pdf = fitz.open()
page = pdf.new_page()
page.insert_text((72, 80), "Titulo Grande", fontsize=24)
page.insert_text((72, 120), "Texto normal do paragrafo de teste.", fontsize=11)
page.insert_text((72, 140), "• item um", fontsize=11)
page.insert_text((72, 160), "• item dois", fontsize=11)
pdf_bytes = pdf.tobytes()
open("/tmp/fixture.pdf", "wb").write(pdf_bytes)

# ── asserts ──
from app.services.convert import docx_to_html, html_to_text, pdf_to_html

h = docx_to_html(docx_bytes)
print("DOCX HTML:", h)
assert "<h1>" in h and "Titulo Um" in h, "heading perdido"
assert "<strong>negrito</strong>" in h, "bold perdido"
assert "<ul>" in h and "item um" in h, "lista perdida"
assert "<table>" in h and "celula A" in h, "tabela perdida"

p = pdf_to_html(pdf_bytes)
print("PDF HTML:", p)
assert "<h1>" in p and "Titulo Grande" in p, "heading heuristico perdido"
assert "<p>" in p and "Texto normal" in p, "paragrafo perdido"
assert "<ul>" in p and "item um" in p, "lista heuristica perdida"

t = html_to_text(h)
assert "Titulo Um" in t and "<" not in t, "html_to_text sujo"

print("TODOS OS ASSERTS PASSARAM")
EOF
```

Esperado: os dois HTMLs impressos + `TODOS OS ASSERTS PASSARAM`. Colar a
saída real no report. Se um assert do DOCX falhar por detalhe do fixture
mínimo (mammoth é tolerante mas o fixture é artesanal), ajustar o FIXTURE
(não o conversor) até representar o caso — e registrar o ajuste.

- [ ] **Step 6: Commit**

```bash
git add backend-api/pyproject.toml backend-api/app/services/__init__.py backend-api/app/services/convert.py
git commit -m "feat(convert): DOCX/PDF -> HTML conversion service (mammoth + pymupdf heuristics)"
```

---

### Task 2: Backend — endpoint /convert com RAG

**Files:**
- Create: `backend-api/app/routers/imports.py`
- Modify: `backend-api/app/main.py` (import + include_router)

**Interfaces:**
- Consumes: `docx_to_html`/`pdf_to_html`/`html_to_text` (Task 1); `_authorize`/`_get_or_404` de `app.routers.documents`; `split_text` de `app.rag.ingest`; `add_chunks` de `app.rag.vectorstore`.
- Produces (Tasks 3-4 dependem): `POST /api/documents/{doc_id}/convert` multipart (`file`) → 200 `{"html": str, "chunks": int}` | 415 | 413 | 400 | 403.

- [ ] **Step 1: Criar o router**

Criar `backend-api/app/routers/imports.py`:

```python
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

    # conversao e CPU-bound -> threadpool, mesmo padrao do ingest do RAG
    html = await asyncio.to_thread(convert, raw)
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
```

- [ ] **Step 2: Registrar no main.py**

Em `backend-api/app/main.py`, a linha de import vira:

```python
from app.routers import auth, comments, documents, imports, internal, rag, webhooks
```

E após `app.include_router(comments.router)`:

```python
app.include_router(imports.router)
```

- [ ] **Step 3: Restart + curl (fixtures da Task 1 já em /tmp do container)**

```bash
docker restart nyx-backend-api && sleep 8
B=http://localhost:8000
LEAD=$(curl -s -X POST $B/api/auth/login -d "username=cm_lead@test.com&password=Test1234!" -H "Content-Type: application/x-www-form-urlencoded" | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
DOC=$(curl -s -X POST $B/api/documents -H "Authorization: Bearer $LEAD" -H "Content-Type: application/json" -d '{"title":"import teste"}' | python -c "import sys,json;print(json.load(sys.stdin)['id'])")

# copiar fixtures pro host (curl le do host)
docker cp nyx-backend-api:/tmp/fixture.docx /tmp/fixture.docx
docker cp nyx-backend-api:/tmp/fixture.pdf /tmp/fixture.pdf

# 1. DOCX -> 200 com html e chunks>0
curl -s -w "\nHTTP:%{http_code}\n" -X POST $B/api/documents/$DOC/convert -H "Authorization: Bearer $LEAD" -F "file=@/tmp/fixture.docx"
# 2. PDF -> 200 com h1/ul no html
curl -s -w "\nHTTP:%{http_code}\n" -X POST $B/api/documents/$DOC/convert -H "Authorization: Bearer $LEAD" -F "file=@/tmp/fixture.pdf"
# 3. formato errado -> 415
printf 'texto' > /tmp/x.txt
curl -s -o /dev/null -w "%{http_code}\n" -X POST $B/api/documents/$DOC/convert -H "Authorization: Bearer $LEAD" -F "file=@/tmp/x.txt"
# 4. >20MB -> 413 (arquivo sintetico com nome .pdf)
python -c "open('/tmp/big.pdf','wb').write(b'0'*(21*1024*1024))"
curl -s -o /dev/null -w "%{http_code}\n" -X POST $B/api/documents/$DOC/convert -H "Authorization: Bearer $LEAD" -F "file=@/tmp/big.pdf"
# 5. PDF sem texto -> 400
docker exec nyx-backend-api python -c "import fitz; d=fitz.open(); d.new_page(); open('/tmp/blank.pdf','wb').write(d.tobytes())"
docker cp nyx-backend-api:/tmp/blank.pdf /tmp/blank.pdf
curl -s -w "\nHTTP:%{http_code}\n" -X POST $B/api/documents/$DOC/convert -H "Authorization: Bearer $LEAD" -F "file=@/tmp/blank.pdf"
# 6. viewer sem edit -> 403
VIEW=$(curl -s -X POST $B/api/auth/login -d "username=cm_viewer@test.com&password=Test1234!" -H "Content-Type: application/x-www-form-urlencoded" | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s -o /dev/null -w "%{http_code}\n" -X POST $B/api/documents/$DOC/convert -H "Authorization: Bearer $VIEW" -F "file=@/tmp/fixture.docx"
# 7. content salvo (fallback) + RAG: busca acha o conteudo
curl -s $B/api/documents/$DOC -H "Authorization: Bearer $LEAD" | python -c "import sys,json;d=json.load(sys.stdin);print('content tem texto:', bool(d['content'] and 'Titulo' in d['content']))"
curl -s -X POST $B/api/rag/search -H "Authorization: Bearer $LEAD" -H "Content-Type: application/json" -d '{"query":"Titulo Grande paragrafo de teste","k":5}' | head -c 400
```

Esperados: 1→200 (html com `<h1>`, chunks≥1) · 2→200 (html com `<h1>`/`<ul>`) ·
3→415 · 4→413 · 5→400 · 6→403 · 7→`content tem texto: True` + hit do RAG
apontando o `documentId` do doc. TODAS as saídas observadas no report.
(Se `/api/rag/search` tiver outro shape de rota, conferir em
`backend-api/app/routers/rag.py` e ajustar o curl — o endpoint de busca já
existe desde a Fase 4.)

- [ ] **Step 4: Commit**

```bash
git add backend-api/app/routers/imports.py backend-api/app/main.py
git commit -m "feat(convert): POST /api/documents/{id}/convert with RAG auto-index"
```

---

### Task 3: Frontend — fluxo header (Importar doc)

**Files:**
- Modify: `frontend/src/api.ts` (2 funções novas)
- Modify: `frontend/src/App.tsx` (botão + input + pendingImport + delete-on-fail)
- Modify: `frontend/src/Editor.tsx` (gating synced + injeção)

**Interfaces:**
- Consumes: endpoint da Task 2; `authedFetch` de `./auth`; `createDocument` existente.
- Produces (Task 4 depende): `convertDocument(token: string, docId: string, file: File): Promise<{ html: string }>` e `deleteDocument(token: string, id: string): Promise<void>` em `api.ts`; props novas de `Editor`: `importHtml: string | null`, `onImportApplied: () => void`.

- [ ] **Step 1: api.ts**

Ao final de `frontend/src/api.ts`:

```ts
export async function convertDocument(
  token: string,
  docId: string,
  file: File,
): Promise<{ html: string }> {
  const form = new FormData();
  form.append("file", file);
  // sem Content-Type manual: o browser define o boundary do multipart
  const res = await authedFetch(`/api/documents/${docId}/convert`, token, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    let detail = "Conversao falhou";
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      // corpo nao-JSON: mantem a mensagem generica
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function deleteDocument(token: string, id: string): Promise<void> {
  const res = await authedFetch(`/api/documents/${id}`, token, { method: "DELETE" });
  if (!res.ok) throw new Error("Apagar documento falhou");
}
```

- [ ] **Step 2: App.tsx — estado + botão + handler**

Imports: adicionar `convertDocument, deleteDocument` ao import de `./api` e
`useRef` ao import de react:

```tsx
import { useEffect, useRef, useState } from "react";
```

Estado novo (junto dos outros useState):

```tsx
  const [pendingImport, setPendingImport] = useState<{ docId: string; html: string } | null>(null);
  const [importErr, setImportErr] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);
```

Handler (depois de `newDoc`):

```tsx
  async function importDoc(file: File) {
    if (!token) return;
    setImportErr("");
    const title = file.name.replace(/\.[^.]+$/, "") || "Documento importado";
    const d = await createDocument(token, title);
    try {
      const { html } = await convertDocument(token, String(d.id), file);
      setPendingImport({ docId: String(d.id), html });
      openDoc(String(d.id));
    } catch (e) {
      // sem docs orfaos: conversao falhou -> apaga o doc recem-criado
      await deleteDocument(token, String(d.id)).catch(() => {});
      setImportErr(e instanceof Error ? e.message : String(e));
    }
  }
```

No header, após o botão `Novo doc`:

```tsx
        <button onClick={() => importInputRef.current?.click()} title="Importar PDF ou DOCX como documento novo">
          Importar doc
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".pdf,.docx"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importDoc(f);
            e.target.value = "";
          }}
        />
```

Logo APÓS o `</header>` (antes de `<main>`):

```tsx
      {importErr && <p className="err">Falha ao importar: {importErr}</p>}
```

No `<Editor ... />` (props novas ao final):

```tsx
            importHtml={pendingImport?.docId === docId ? pendingImport.html : null}
            onImportApplied={() => setPendingImport(null)}
```

- [ ] **Step 3: Editor.tsx — synced + injeção**

Assinatura do componente `Editor` ganha (após `onNewComment`):

```tsx
  importHtml: string | null;
  onImportApplied: () => void;
```

(e os campos correspondentes no tipo das props:)

```tsx
  importHtml: string | null;
  onImportApplied: () => void;
```

Estado novo em `Editor`:

```tsx
  const [synced, setSynced] = useState(false);
```

No useEffect que cria o provider: primeiro `setSynced(false);` como primeira
linha do corpo, e a config do `HocuspocusProvider` ganha (após `onStatus`):

```tsx
      onSynced: () => setSynced(true),
```

No `<EditorArea ... />`, props novas:

```tsx
        importHtml={synced ? importHtml : null}
        onImportApplied={onImportApplied}
```

`EditorArea`: assinatura ganha `importHtml: string | null;` e
`onImportApplied: () => void;` (destructuring + tipo). Após o useEffect do
`onEditorReady`, adicionar:

```tsx
  // injecao do import (fluxo header): so depois do synced do provider, pra
  // substituir o conteudo semeado pelo onLoadDocument em vez de colidir com ele
  useEffect(() => {
    if (!editor || !importHtml) return;
    editor.commands.setContent(importHtml);
    onImportApplied();
  }, [editor, importHtml]);
```

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npm run typecheck
```

Esperado: exit 0.

- [ ] **Step 5: Verificação manual (browser, docker :5173)**

1. Login `engineer_lead`. Header mostra **Importar doc**.
2. Importar o `/tmp/fixture.docx` (da Task 2) → doc novo abre com título
   "fixture", conteúdo com **Titulo Um** como heading, "negrito" em bold,
   lista com 2 itens, tabela 1x2 — tudo EDITÁVEL.
3. Recarregar a página e reabrir o doc → conteúdo persiste (Y.js gravou).
4. Importar `/tmp/x.txt` (renomear pra .txt não passa no accept — testar
   colando um .pdf corrompido: `printf 'nao é pdf' > /tmp/fake.pdf`) →
   mensagem "Falha ao importar: ..." aparece e NENHUM doc órfão fica na
   lista (conferir abrindo o id seguinte — 404).
5. Console sem erros.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api.ts frontend/src/App.tsx frontend/src/Editor.tsx
git commit -m "feat(import): header flow - convert PDF/DOCX into new editable doc"
```

---

### Task 4: Frontend — fluxo toolbar (importar no cursor)

**Files:**
- Modify: `frontend/src/Toolbar.tsx` (botão 📥 + input + prop)
- Modify: `frontend/src/Editor.tsx` (token pro EditorArea + handler)

**Interfaces:**
- Consumes: `convertDocument` (Task 3); props existentes do Toolbar (`{ editor, docId, canEdit, onNewComment, suggesting, onToggleSuggesting }`).
- Produces: prop nova do Toolbar: `onImportFile: (file: File) => void`.

- [ ] **Step 1: Editor.tsx — token + handler no EditorArea**

`Editor` já recebe `token`. Repassar pro `EditorArea`:

```tsx
        token={token}
```

`EditorArea`: assinatura ganha `token: string;` (destructuring + tipo).
Import no topo do arquivo (junto do import de `getDocument`):

```tsx
import { convertDocument, getDocument, updateDocument } from "./api";
```

(substitui a linha de import existente de `getDocument, updateDocument`.)

Dentro de `EditorArea`, após o useEffect da injeção do import:

```tsx
  const [toolbarImportErr, setToolbarImportErr] = useState("");

  async function importIntoDoc(file: File) {
    if (!editor) return;
    setToolbarImportErr("");
    try {
      const { html } = await convertDocument(token, docId, file);
      editor.chain().focus().insertContent(html).run();
    } catch (e) {
      setToolbarImportErr(e instanceof Error ? e.message : String(e));
    }
  }
```

(`useState` já está importado no arquivo.)

No JSX do `EditorArea`, passar pro Toolbar e renderizar o erro entre o
`<Toolbar>` e o `.wordcount`:

```tsx
      <Toolbar
        editor={editor}
        docId={docId}
        canEdit={canEdit}
        onNewComment={onNewComment}
        suggesting={!canEdit || suggesting}
        onToggleSuggesting={() => setSuggesting((v) => !v)}
        onImportFile={importIntoDoc}
      />
      {toolbarImportErr && <p className="err">Falha ao importar: {toolbarImportErr}</p>}
```

- [ ] **Step 2: Toolbar.tsx — botão + input**

Assinatura ganha:

```tsx
  onImportFile: (file: File) => void;
```

Ref novo (junto do `fileInputRef`):

```tsx
  const importInputRef = useRef<HTMLInputElement>(null);
```

Na row 2, logo após o botão 💬 (antes do bloco condicional da tabela):

```tsx
        {btn(
          "📥",
          canEdit ? "Importar PDF/DOCX no documento" : "Importar (requer permissão de edição)",
          () => importInputRef.current?.click(),
          false,
          !canEdit,
        )}
```

Ao lado do input de imagem existente (final da row 2):

```tsx
        <input
          ref={importInputRef}
          type="file"
          accept=".pdf,.docx"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImportFile(f);
            e.target.value = "";
          }}
        />
```

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npm run typecheck
```

Esperado: exit 0.

- [ ] **Step 4: Verificação manual (browser)**

1. `engineer_lead`, doc existente com texto. Clicar no meio do texto, 📥,
   escolher `/tmp/fixture.pdf` → conteúdo do PDF (heading + parágrafo +
   lista) entra NA POSIÇÃO DO CURSOR; o texto original continua antes/depois.
2. Assistente IA (aba IA): perguntar "Titulo Grande paragrafo de teste" →
   RAG retorna o doc entre as fontes.
3. `engineer_l1` num doc alheio: 📥 desabilitado com tooltip. No header,
   "Importar doc" continua habilitado (doc próprio).
4. Console sem erros nas duas sessões.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/Toolbar.tsx frontend/src/Editor.tsx
git commit -m "feat(import): toolbar flow - insert converted PDF/DOCX at cursor"
```

---

## Self-Review (executado na escrita do plano)

**Cobertura do spec:**
- mammoth + pymupdf com heurísticas declaradas (1.25/1.4/1.6× mediana, flag bold, bullets) → Task 1. ✓
- Endpoint único com 415/413/400, autz edit, RAG auto (`split_text`+`add_chunks`, threadpool), `content` fallback, `{html, chunks}` → Task 2. ✓
- Fluxo header (criar → converter → abrir → setContent pós-synced; delete-on-fail) → Task 3. ✓
- Fluxo toolbar (insertContent no cursor, gated por can_edit) → Task 4. ✓
- Rebuild da imagem por causa das deps → Task 1 Step 4 (Global Constraints avisa). ✓
- Testes do spec: asserts com fixtures no container (T1), curl com todos os códigos de erro + RAG search (T2), tsc (T3/T4), E2E manual dois papéis (T3/T4). ✓
- Fora de escopo respeitado (sem ODT/OCR/original/export/lote). ✓

**Placeholders:** nenhum — todo step tem código/comando/saída esperada.

**Consistência de tipos:** `convertDocument(token, docId, file) -> {html}` idêntico em T3 (definição) e T4 (uso); props `importHtml`/`onImportApplied` batem entre App (T3 S2) e Editor (T3 S3); `onImportFile(file: File)` bate entre EditorArea (T4 S1) e Toolbar (T4 S2); shape do retorno do endpoint `{"html", "chunks"}` (T2) vs frontend lê só `html` (ok, subset).

**Notas de risco:**
- Fixture DOCX é artesanal (zip mínimo) — se o mammoth reclamar, a Task 1 manda ajustar o fixture, não o conversor.
- Imagem em DOCX: comportamento default do mammoth (data-URI) — sem teste automatizado no plano; coberto por E2E com arquivo real quando o usuário tiver um.
- `onSynced` do HocuspocusProvider dispara a cada reconexão — a injeção usa `importHtml` one-shot (limpo via `onImportApplied` logo após aplicar), então re-sync não re-injeta.
