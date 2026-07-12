# Comentários & Track Changes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comentários em threads ancorados no texto (backend MySQL + sidebar com abas) e track changes (modo sugestão) amarrado ao ABAC — viewers sempre em modo sugestão, editores aceitam/rejeitam.

**Architecture:** Comentários = mark Tiptap (`@sereneinserenade/tiptap-comment-extension`, mark `span[data-comment-id]`) + storage próprio (tabela `comments` no MySQL, 4 endpoints REST reusando o `_authorize` Cerbos existente). Track changes = extensão vendorizada (`chenyuncai/tiptap-track-change-extension`, arquivo TS único copiado do master do GitHub — as versões npm são Tiptap v3-only, nosso projeto é v2). Sidebar direita vira abas IA | Comentários | Sugestões.

**Tech Stack:** FastAPI + SQLAlchemy async + Alembic (backend), React + TypeScript + Tiptap v2 + Y.js/Hocuspocus (frontend), Cerbos (ABAC), MySQL.

## Global Constraints

- Tiptap core packages ficam em `^2.11.0` (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`, `@tiptap/extension-collaboration`) — NUNCA atualizar; extensões avulsas em `^2.27.2`.
- Track change extension: **NÃO instalar do npm** (`tiptap-track-change-extension@1.x` fixa peer `@tiptap/core: 3.18.0`, incompatível). Vendorizar `src/index.ts` do branch `master` de `chenyuncai/tiptap-track-change-extension` (peers `^2.0.0-beta.220` = v2, MIT).
- Comments extension: `@sereneinserenade/tiptap-comment-extension@^0.2.0` do npm (peers `^2.0.0 || ^3.0.0`, compatível).
- Container `nyx-frontend` tem `node_modules` em volume anônimo (`- /app/node_modules` no compose): todo `npm install` deve rodar TAMBÉM dentro do container (`docker exec nyx-frontend npm install`), senão o dev server não vê o pacote.
- Backend NÃO tem hot-reload (sem `--reload` no compose): após editar código do backend, `docker restart nyx-backend-api` (o entrypoint roda `alembic upgrade head` automaticamente).
- Wire format da API é snake_case (`owner_id`, `created_at`): o campo novo é `can_edit` (o spec escreveu `canEdit`, mas a convenção do projeto vence — anotado como desvio consciente).
- Cerbos (infra/cerbos/policies/document.yaml): `engineer_l1` = view; `engineer_lead` = view+edit; `admin` = tudo; owner (derived) = tudo no próprio doc. NENHUMA policy nova.
- Labels de UI em português.
- `StarterKit.configure({ history: false })` permanece; undo/redo continua vindo do Collaboration.
- Verificação frontend: container docker em `http://localhost:5173` (bind-mount + HMR), backend em `http://localhost:8000`. NÃO subir Vite local em outra porta (CORS só permite 5173).
- Fora de escopo: resolução automática de conflito entre sugestões concorrentes, notificações, menções `@usuario`.
- Backend não tem framework de teste; o spec prescreve verificação via curl — cada task backend termina com curl real contra o container (evidência de saída obrigatória, não "deveria funcionar").
- `frontend && npm run typecheck` (tsc --noEmit) precisa passar em toda task frontend.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `frontend/src/extensions/track-change.ts` | (novo, Task 1) extensão vendorizada de track change |
| `backend-api/app/models/comment.py` | (novo, Task 2) model `Comment` |
| `backend-api/alembic/versions/0003_comments.py` | (novo, Task 2) migration da tabela |
| `backend-api/app/schemas/comment.py` | (novo, Task 3) schemas Pydantic |
| `backend-api/app/routers/comments.py` | (novo, Task 3) 4 endpoints REST |
| `backend-api/app/schemas/document.py` | (mod, Task 4) `can_edit` no `DocumentOut` |
| `backend-api/app/routers/documents.py` | (mod, Task 4) `_can()` extraído de `_authorize()`, `can_edit` computado |
| `frontend/src/api.ts` | (mod, Tasks 5) `fetchMe()` + client de comments + `can_edit` na interface |
| `frontend/src/Sidebar.tsx` | (novo, Task 5) container de abas IA / Comentários / Sugestões |
| `frontend/src/AiSidebar.tsx` | (mod, Task 5) vira conteúdo de painel (perde o `<aside>`) |
| `frontend/src/App.tsx` | (mod, Tasks 5-7) estado compartilhado: `me`, `editorInst`, `canEdit`, aba, mark ativo/draft |
| `frontend/src/Editor.tsx` | (mod, Tasks 1,5,7) registra extensões, threading de callbacks |
| `frontend/src/CommentsPanel.tsx` | (novo, Tasks 5-6) threads: lista, criar, reply, resolver, apagar |
| `frontend/src/Toolbar.tsx` | (mod, Tasks 6-7) botão 💬 e toggle "Modo sugestão" |
| `frontend/src/SuggestionsPanel.tsx` | (novo, Task 7) lista de sugestões + aceitar/rejeitar |
| `frontend/src/styles.css` | (mod, Tasks 5-7) CSS de abas, marks, threads, sugestões |

---

### Task 1: Spike — TrackChangeExtension vendorizada + Collaboration (GATE GO/NO-GO)

O spec exige este spike ANTES de qualquer UI: a extensão intercepta transações
ProseMirror e o Y.js aplica as suas próprias para sincronizar — pode corromper
estado. Se NO-GO: parar o plano, reportar (plano B do spec: reavaliar Tiptap
Pro ou adiar o recurso).

**Files:**
- Create: `frontend/src/extensions/track-change.ts` (vendorizado)
- Modify: `frontend/src/Editor.tsx` (registrar extensão, `enabled: false`)

**Interfaces:**
- Consumes: nada (primeira task)
- Produces: `frontend/src/extensions/track-change.ts` exportando `TrackChangeExtension` (default e named export), marks `insertion`/`deletion` (renderizam `<insert>`/`<delete>` com attrs `data-op-user-id`, `data-op-user-nickname`, `data-op-date`), comandos `setTrackChangeStatus(enabled)`, `getTrackChangeStatus()`, `toggleTrackChangeStatus()`, `acceptChange()`, `acceptAllChanges()`, `rejectChange()`, `rejectAllChanges()`, `updateOpUserOption(id, nickname)`. Options: `{ enabled: boolean, onStatusChange?: Function, dataOpUserId?: string, dataOpUserNickname?: string }`. **Atenção: é `acceptAllChanges`/`rejectAllChanges` (plural) — o spec escreveu `acceptAllChange`, a API real é plural.**

- [ ] **Step 1: Vendorizar o arquivo**

Na raiz do repo (Git Bash):

```bash
mkdir -p frontend/src/extensions
gh api repos/chenyuncai/tiptap-track-change-extension/contents/src/index.ts --jq '.content' | base64 -d > frontend/src/extensions/track-change.ts
```

Adicionar como PRIMEIRAS linhas do arquivo (Edit tool):

```ts
// Vendorizado de https://github.com/chenyuncai/tiptap-track-change-extension
// (master, track-change-extension@1.0.3, MIT). Motivo: as versões npm fixam
// peer @tiptap/core 3.18.0 (v3-only); este projeto é Tiptap v2 (^2.11.0).
```

- [ ] **Step 2: Typecheck e corrigir erros de tipo (se houver)**

```bash
cd frontend && npm run typecheck
```

Esperado: PASS. Se o arquivo vendorizado der erros de strict-mode, corrigir
com anotações mínimas (`as`/tipos explícitos) SEM alterar lógica; documentar
cada correção no report.

- [ ] **Step 3: Registrar no Editor.tsx (inerte)**

Em `frontend/src/Editor.tsx`, adicionar import (após o import de `CharacterCount`):

```tsx
import { TrackChangeExtension } from "./extensions/track-change";
```

No array `extensions:` de `EditorArea`, após `CharacterCount,`:

```tsx
        TrackChangeExtension.configure({ enabled: false }),
```

- [ ] **Step 4: Expor editor pro teste (temporário, NÃO commitar)**

Em `EditorArea`, logo após `const editor = useEditor(...)`:

```tsx
  // @ts-expect-error spike scaffolding
  window.__editor = editor;
```

- [ ] **Step 5: Teste de convergência com 2 abas**

Pré-requisito: stack docker rodando (`nyx-frontend` em :5173, `nyx-realtime` em :1234).

1. Abrir 2 abas do browser em `http://localhost:5173`, logar com o MESMO usuário `engineer_lead` (ou registrar um), abrir o MESMO doc nas duas (usar um doc de teste novo criado via "Novo doc").
2. Confirmar WS `connected` nas duas abas (texto de status acima do editor).
3. Na aba A, console: `window.__editor.commands.setTrackChangeStatus(true)` → digitar `sugestao aqui` no editor.
4. Verificar aba A: texto envolto em `<insert data-op-user-id ...>` (inspecionar DOM `.prose insert`).
5. Verificar aba B: o MESMO `<insert>` apareceu (sincronizou via Y.js).
6. Na aba A: selecionar um trecho e deletar → vira `<delete>` (tachado), não remove. Conferir na aba B.
7. Na aba A, console: `window.__editor.commands.acceptAllChanges()` → `<insert>` vira texto normal, `<delete>` some. Conferir aba B converge idêntica.
8. Repetir 3-6 e rodar `window.__editor.commands.rejectAllChanges()` → inserções somem, deleções restauram. Conferir aba B.
9. Console das duas abas: ZERO erros (Y.js/ProseMirror/React).

**GO** = passos 4-9 todos OK. **NO-GO** = qualquer divergência entre abas,
erro de console, ou estado corrompido → parar plano, reportar.

- [ ] **Step 6: Remover scaffolding e commitar**

Remover as 2 linhas do Step 4. Rodar `npm run typecheck` de novo (PASS).

```bash
git add frontend/src/extensions/track-change.ts frontend/src/Editor.tsx
git commit -m "feat(editor): vendor track-change extension, register disabled (spike GO)"
```

O report da task DEVE registrar o veredito GO/NO-GO com a evidência observada.

---

### Task 2: Backend — model Comment + migration

**Files:**
- Create: `backend-api/app/models/comment.py`
- Create: `backend-api/alembic/versions/0003_comments.py`
- Modify: `backend-api/app/models/__init__.py`

**Interfaces:**
- Consumes: `Base`, `TimestampMixin` de `app.models.base`
- Produces: model `Comment` com colunas `id: int`, `document_id: int`, `mark_id: str`, `author_id: int`, `parent_id: int | None`, `body: str`, `resolved: bool`, `created_at/updated_at` (mixin). Tabela `comments` no MySQL.

- [ ] **Step 1: Model**

Criar `backend-api/app/models/comment.py`:

```python
from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Comment(Base, TimestampMixin):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    # uuid gerado no client; e o id usado por setComment() no mark do Tiptap
    mark_id: Mapped[str] = mapped_column(String(36), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    # reply em thread; cascade: apagar a raiz apaga as replies
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("comments.id", ondelete="CASCADE"), nullable=True
    )
    body: Mapped[str] = mapped_column(Text)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
```

- [ ] **Step 2: Registrar no __init__**

`backend-api/app/models/__init__.py` vira:

```python
from app.models.base import Base
from app.models.comment import Comment
from app.models.document import Document
from app.models.permission import Permission
from app.models.user import User

__all__ = ["Base", "Comment", "User", "Document", "Permission"]
```

- [ ] **Step 3: Migration**

Criar `backend-api/alembic/versions/0003_comments.py`:

```python
"""comments table

Revision ID: 0003
Revises: d6718bf186c2
Create Date: 2026-07-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "d6718bf186c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "comments",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "document_id",
            sa.Integer,
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("mark_id", sa.String(36), nullable=False),
        sa.Column(
            "author_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "parent_id",
            sa.Integer,
            sa.ForeignKey("comments.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("resolved", sa.Boolean, nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_comments_document_id", "comments", ["document_id"])
    op.create_index("ix_comments_mark_id", "comments", ["mark_id"])


def downgrade() -> None:
    op.drop_table("comments")
```

- [ ] **Step 4: Aplicar, reverter, reaplicar (teste do spec)**

O código está bind-mounted em `/app` no container:

```bash
docker exec nyx-backend-api alembic upgrade head
docker exec nyx-backend-api alembic current        # esperado: 0003 (head)
docker exec nyx-backend-api alembic downgrade -1
docker exec nyx-backend-api alembic current        # esperado: d6718bf186c2
docker exec nyx-backend-api alembic upgrade head
docker exec nyx-backend-api python -c "import asyncio, sqlalchemy as sa; from app.db import engine
async def m():
    async with engine.connect() as c:
        r = await c.execute(sa.text('SHOW COLUMNS FROM comments'))
        print([row[0] for row in r])
asyncio.run(m())"
```

Esperado no último: `['id', 'document_id', 'mark_id', 'author_id', 'parent_id', 'body', 'resolved', 'created_at', 'updated_at']`.

- [ ] **Step 5: Commit**

```bash
git add backend-api/app/models/comment.py backend-api/app/models/__init__.py backend-api/alembic/versions/0003_comments.py
git commit -m "feat(comments): comments table model + migration"
```

---

### Task 3: Backend — endpoints de comentários

**Files:**
- Create: `backend-api/app/schemas/comment.py`
- Create: `backend-api/app/routers/comments.py`
- Modify: `backend-api/app/main.py` (linhas 5 e 17-21: import + include_router)

**Interfaces:**
- Consumes: `Comment` (Task 2); `_authorize(db, user, doc, action)` e `_get_or_404(db, doc_id)` de `app.routers.documents`; `get_current_user` de `app.auth.deps`; `get_db` de `app.db`.
- Produces:
  - `GET /api/documents/{doc_id}/comments` → `list[CommentOut]` (autz: view)
  - `POST /api/documents/{doc_id}/comments` body `CommentCreate` → `CommentOut` 201 (autz: edit)
  - `PATCH /api/comments/{comment_id}` body `CommentUpdate` → `CommentOut` (autor OU edit)
  - `DELETE /api/comments/{comment_id}` → 204 (autor OU edit)
  - `CommentOut = { id, document_id, mark_id, author_id, author_name, parent_id, body, resolved, created_at, updated_at }` — `author_name` = `full_name or email` do autor.

- [ ] **Step 1: Schemas**

Criar `backend-api/app/schemas/comment.py`:

```python
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
```

- [ ] **Step 2: Router**

Criar `backend-api/app/routers/comments.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.db import get_db
from app.models.comment import Comment
from app.models.document import Document
from app.models.user import User
from app.routers.documents import _authorize, _get_or_404
from app.schemas.comment import CommentCreate, CommentOut, CommentUpdate

router = APIRouter(prefix="/api", tags=["comments"])


def _to_out(c: Comment, author_name: str | None, author_email: str) -> CommentOut:
    return CommentOut(
        id=c.id,
        document_id=c.document_id,
        mark_id=c.mark_id,
        author_id=c.author_id,
        author_name=author_name or author_email,
        parent_id=c.parent_id,
        body=c.body,
        resolved=c.resolved,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


async def _comment_or_404(db: AsyncSession, comment_id: int) -> Comment:
    c = await db.get(Comment, comment_id)
    if c is None:
        raise HTTPException(status_code=404, detail="Comentario nao encontrado")
    return c


async def _author_or_editor(db: AsyncSession, user: User, c: Comment) -> None:
    # autor do comentario sempre pode; senao precisa de "edit" no doc (Cerbos)
    if user.id == c.author_id:
        return
    doc = await db.get(Document, c.document_id)
    await _authorize(db, user, doc, "edit")


@router.get("/documents/{doc_id}/comments", response_model=list[CommentOut])
async def list_comments(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = await _get_or_404(db, doc_id)
    await _authorize(db, user, doc, "view")
    rows = await db.execute(
        select(Comment, User.full_name, User.email)
        .join(User, User.id == Comment.author_id)
        .where(Comment.document_id == doc_id)
        .order_by(Comment.created_at)
    )
    return [_to_out(c, name, email) for c, name, email in rows.all()]


@router.post(
    "/documents/{doc_id}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    doc_id: int,
    payload: CommentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = await _get_or_404(db, doc_id)
    await _authorize(db, user, doc, "edit")
    if payload.parent_id is not None:
        parent = await db.get(Comment, payload.parent_id)
        if parent is None or parent.document_id != doc_id:
            raise HTTPException(status_code=404, detail="Comentario pai nao encontrado")
    c = Comment(
        document_id=doc_id,
        mark_id=payload.mark_id,
        author_id=user.id,
        parent_id=payload.parent_id,
        body=payload.body,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return _to_out(c, user.full_name, user.email)


@router.patch("/comments/{comment_id}", response_model=CommentOut)
async def update_comment(
    comment_id: int,
    payload: CommentUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    c = await _comment_or_404(db, comment_id)
    await _author_or_editor(db, user, c)
    if payload.body is not None:
        c.body = payload.body
    if payload.resolved is not None:
        c.resolved = payload.resolved
    await db.commit()
    await db.refresh(c)
    author = await db.get(User, c.author_id)
    return _to_out(c, author.full_name if author else None, author.email if author else "?")


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    c = await _comment_or_404(db, comment_id)
    await _author_or_editor(db, user, c)
    await db.delete(c)
    await db.commit()
```

- [ ] **Step 3: Registrar no main.py**

Em `backend-api/app/main.py`, linha 5 vira:

```python
from app.routers import auth, comments, documents, internal, rag, webhooks
```

E após `app.include_router(documents.router)` adicionar:

```python
app.include_router(comments.router)
```

- [ ] **Step 4: Restart + curl com os 2 papéis (teste do spec)**

```bash
docker restart nyx-backend-api && sleep 6
B=http://localhost:8000

# usuarios de teste
curl -s -X POST $B/api/auth/register -H "Content-Type: application/json" -d '{"email":"cm_lead@test.com","password":"Test1234!","role":"engineer_lead"}'
curl -s -X POST $B/api/auth/register -H "Content-Type: application/json" -d '{"email":"cm_viewer@test.com","password":"Test1234!","role":"engineer_l1"}'
LEAD=$(curl -s -X POST $B/api/auth/login -d "username=cm_lead@test.com&password=Test1234!" -H "Content-Type: application/x-www-form-urlencoded" | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
VIEW=$(curl -s -X POST $B/api/auth/login -d "username=cm_viewer@test.com&password=Test1234!" -H "Content-Type: application/x-www-form-urlencoded" | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# doc do lead
DOC=$(curl -s -X POST $B/api/documents -H "Authorization: Bearer $LEAD" -H "Content-Type: application/json" -d '{"title":"doc comentarios"}' | python -c "import sys,json;print(json.load(sys.stdin)['id'])")

# 1. lead cria comentario -> 201
curl -s -w "\n%{http_code}\n" -X POST $B/api/documents/$DOC/comments -H "Authorization: Bearer $LEAD" -H "Content-Type: application/json" -d '{"mark_id":"11111111-1111-1111-1111-111111111111","body":"primeiro comentario"}'
# 2. viewer tenta criar -> 403
curl -s -o /dev/null -w "%{http_code}\n" -X POST $B/api/documents/$DOC/comments -H "Authorization: Bearer $VIEW" -H "Content-Type: application/json" -d '{"mark_id":"22222222-2222-2222-2222-222222222222","body":"nao deveria"}'
# 3. viewer lista -> 200 com 1 item, author_name presente
curl -s -w "\n%{http_code}\n" $B/api/documents/$DOC/comments -H "Authorization: Bearer $VIEW"
# 4. lead cria reply (parent_id = id do passo 1) -> 201
# 5. viewer tenta PATCH resolved -> 403 (nao e autor, nao tem edit)
# 6. lead PATCH resolved=true -> 200 com resolved:true
# 7. lead DELETE raiz -> 204; GET lista -> [] (cascade apagou a reply)
# 8. POST com parent_id inexistente -> 404
```

Passos 4-8: mesmos comandos curl variando token/payload/verbo — TODOS os
status codes devem ser observados e colados no report (não "esperado").

- [ ] **Step 5: Commit**

```bash
git add backend-api/app/schemas/comment.py backend-api/app/routers/comments.py backend-api/app/main.py
git commit -m "feat(comments): CRUD endpoints reusing Cerbos document authz"
```

---

### Task 4: Backend — `can_edit` na resposta de documentos

**Files:**
- Modify: `backend-api/app/schemas/document.py` (DocumentOut)
- Modify: `backend-api/app/routers/documents.py:28-41` (extrair `_can` de `_authorize`) e os 3 endpoints que retornam DocumentOut

**Interfaces:**
- Consumes: `cerbos.is_allowed(...)` já usado em `_authorize`
- Produces: `DocumentOut.can_edit: bool` — `GET /api/documents/{id}` computa via Cerbos; `POST /api/documents` retorna `true` (criador = owner); `PUT /api/documents/{id}` retorna `true` (acabou de autorizar edit). Nova função `_can(db, user, doc, action) -> bool` em `documents.py` (não levanta exceção).

- [ ] **Step 1: Schema**

Em `backend-api/app/schemas/document.py`, `DocumentOut` vira:

```python
class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    owner_id: int
    content: str | None
    created_at: datetime
    updated_at: datetime
    # computado por endpoint (nao vem do model); False so ate o router setar
    can_edit: bool = False
```

- [ ] **Step 2: Extrair `_can` e usar nos endpoints**

Em `backend-api/app/routers/documents.py`, substituir `_authorize` (linhas 28-41) por:

```python
async def _can(db: AsyncSession, user: User, doc: Document, action: str) -> bool:
    return await cerbos.is_allowed(
        principal_id=str(user.id),
        roles=await _roles_for(db, user, doc),
        action=action,
        resource_kind="document",
        resource_id=str(doc.id),
        resource_attr={"ownerId": str(doc.owner_id)},
    )


async def _authorize(db: AsyncSession, user: User, doc: Document, action: str) -> None:
    if not await _can(db, user, doc, action):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Cerbos negou acao '{action}'",
        )
```

`create_document` — trocar o `return doc` final por:

```python
    return DocumentOut.model_validate(doc).model_copy(update={"can_edit": True})
```

`get_document` — trocar o `return doc` final por:

```python
    out = DocumentOut.model_validate(doc)
    return out.model_copy(update={"can_edit": await _can(db, user, doc, "edit")})
```

`update_document` — trocar o `return doc` final por:

```python
    return DocumentOut.model_validate(doc).model_copy(update={"can_edit": True})
```

Adicionar `DocumentOut` já está importado (linha 11) — nada a mudar nos imports.

- [ ] **Step 3: Restart + curl**

```bash
docker restart nyx-backend-api && sleep 6
B=http://localhost:8000
# reusar LEAD/VIEW/DOC da Task 3 (ou recriar igual)
# 1. lead (owner) GET -> "can_edit": true
curl -s $B/api/documents/$DOC -H "Authorization: Bearer $LEAD" | python -m json.tool | grep can_edit
# 2. viewer GET -> "can_edit": false
curl -s $B/api/documents/$DOC -H "Authorization: Bearer $VIEW" | python -m json.tool | grep can_edit
# 3. viewer cria doc proprio; GET nele -> "can_edit": true (derived owner)
VDOC=$(curl -s -X POST $B/api/documents -H "Authorization: Bearer $VIEW" -H "Content-Type: application/json" -d '{"title":"doc do viewer"}' | python -c "import sys,json;print(json.load(sys.stdin)['id'])")
curl -s $B/api/documents/$VDOC -H "Authorization: Bearer $VIEW" | python -m json.tool | grep can_edit
```

Esperado: `true` / `false` / `true` — colar saída real no report.

- [ ] **Step 4: Commit**

```bash
git add backend-api/app/schemas/document.py backend-api/app/routers/documents.py
git commit -m "feat(documents): expose can_edit (Cerbos edit check) in document responses"
```

---

### Task 5: Frontend — extensão de comentário + `fetchMe` + sidebar em abas + lista read-only

Registrar a `CommentExtension` JÁ NESTA TASK é obrigatório: sem ela no schema
do editor, o Tiptap DESCARTA marks `span[data-comment-id]` existentes ao abrir
um doc (perda de dados silenciosa via Y.js).

**Files:**
- Modify: `frontend/package.json` (+ `@sereneinserenade/tiptap-comment-extension`)
- Modify: `frontend/src/api.ts` (fetchMe, can_edit, client de comments)
- Create: `frontend/src/Sidebar.tsx`
- Create: `frontend/src/CommentsPanel.tsx` (read-only nesta task)
- Modify: `frontend/src/AiSidebar.tsx` (`<aside>` → `<div>`)
- Modify: `frontend/src/App.tsx` (estado me/tab/canEdit/editorInst/markIds + render Sidebar)
- Modify: `frontend/src/Editor.tsx` (registrar CommentExtension, threading de callbacks)
- Modify: `frontend/src/styles.css` (abas + mark de comentário)

**Interfaces:**
- Consumes: endpoints das Tasks 3-4; `authedFetch` de `./auth`; `CommentExtension` do pacote npm (options `{ HTMLAttributes, onCommentActivated(commentId: string) }`, comandos `setComment(id)`/`unsetComment(id)`, mark `span[data-comment-id]`).
- Produces (usados nas Tasks 6-7):
  - `api.ts`: `MeOut { id: number; email: string; full_name: string | null; role: string }`, `fetchMe(token): Promise<MeOut>`, `CommentOut { id: number; document_id: number; mark_id: string; author_id: number; author_name: string; parent_id: number | null; body: string; resolved: boolean; created_at: string; updated_at: string }`, `listComments(token, docId): Promise<CommentOut[]>`, `createComment(token, docId, payload: { mark_id: string; body: string; parent_id?: number }): Promise<CommentOut>`, `updateComment(token, commentId, patch: { body?: string; resolved?: boolean }): Promise<CommentOut>`, `deleteComment(token, commentId): Promise<void>`; `DocumentOut` ganha `can_edit: boolean`.
  - `Sidebar.tsx`: `export type SidebarTab = "ia" | "comments" | "suggestions"`; props `{ token, docId, editor, me, canEdit, tab, onTab, activeMarkId, draftMarkId, onDraftDone, onOpenDoc }`.
  - `Editor.tsx` props novas: `me: MeOut`, `onEditorReady(editor | null)`, `onCanEdit(canEdit: boolean)`, `onCommentActivated(markId: string | null)`, `onNewComment(markId: string)` (repassada ao Toolbar na Task 6; nesta task o Toolbar ainda não a usa).

- [ ] **Step 1: Instalar o pacote (host E container)**

```bash
cd frontend && npm install @sereneinserenade/tiptap-comment-extension@^0.2.0
docker exec nyx-frontend npm install @sereneinserenade/tiptap-comment-extension@^0.2.0
```

Verificar `frontend/package.json`: entrada `"@sereneinserenade/tiptap-comment-extension": "^0.2.0"` em ordem alfabética (primeiro item, antes de `@hocuspocus/provider`). Core Tiptap intocado.

- [ ] **Step 2: api.ts — fetchMe + can_edit + client de comments**

Em `frontend/src/api.ts`, adicionar ao final:

```ts
export interface MeOut {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
}

export async function fetchMe(token: string): Promise<MeOut> {
  const res = await authedFetch("/api/auth/me", token);
  if (!res.ok) throw new Error("Buscar usuario falhou");
  return res.json();
}

export interface CommentOut {
  id: number;
  document_id: number;
  mark_id: string;
  author_id: number;
  author_name: string;
  parent_id: number | null;
  body: string;
  resolved: boolean;
  created_at: string;
  updated_at: string;
}

export async function listComments(token: string, docId: string): Promise<CommentOut[]> {
  const res = await authedFetch(`/api/documents/${docId}/comments`, token);
  if (!res.ok) throw new Error("Listar comentarios falhou");
  return res.json();
}

export async function createComment(
  token: string,
  docId: string,
  payload: { mark_id: string; body: string; parent_id?: number },
): Promise<CommentOut> {
  const res = await authedFetch(`/api/documents/${docId}/comments`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Criar comentario falhou");
  return res.json();
}

export async function updateComment(
  token: string,
  commentId: number,
  patch: { body?: string; resolved?: boolean },
): Promise<CommentOut> {
  const res = await authedFetch(`/api/comments/${commentId}`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Atualizar comentario falhou");
  return res.json();
}

export async function deleteComment(token: string, commentId: number): Promise<void> {
  const res = await authedFetch(`/api/comments/${commentId}`, token, { method: "DELETE" });
  if (!res.ok) throw new Error("Apagar comentario falhou");
}
```

E na interface `DocumentOut` existente, adicionar o campo:

```ts
  can_edit: boolean;
```

- [ ] **Step 3: AiSidebar vira painel**

Em `frontend/src/AiSidebar.tsx`: trocar o elemento raiz `<aside className="sidebar">` por `<div className="panel">` (e o fechamento correspondente). Nada mais muda.

- [ ] **Step 4: Sidebar.tsx (container de abas)**

Criar `frontend/src/Sidebar.tsx`:

```tsx
import type { Editor as TiptapEditor } from "@tiptap/react";

import { AiSidebar } from "./AiSidebar";
import { CommentsPanel } from "./CommentsPanel";
import type { MeOut } from "./api";

export type SidebarTab = "ia" | "comments" | "suggestions";

export function Sidebar({
  token,
  docId,
  editor,
  me,
  canEdit,
  tab,
  onTab,
  activeMarkId,
  draftMarkId,
  onDraftDone,
  onOpenDoc,
}: {
  token: string;
  docId: string;
  editor: TiptapEditor | null;
  me: MeOut;
  canEdit: boolean;
  tab: SidebarTab;
  onTab: (t: SidebarTab) => void;
  activeMarkId: string | null;
  draftMarkId: string | null;
  onDraftDone: () => void;
  onOpenDoc: (id: string) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        <button className={tab === "ia" ? "active" : ""} onClick={() => onTab("ia")}>
          IA
        </button>
        <button
          className={tab === "comments" ? "active" : ""}
          onClick={() => onTab("comments")}
          disabled={!docId}
          title={docId ? "Comentários do documento" : "Abra um documento"}
        >
          Comentários
        </button>
        {/* aba Sugestões entra na Task 7 (só canEdit) */}
      </div>
      {tab === "ia" && <AiSidebar token={token} onOpenDoc={onOpenDoc} />}
      {tab === "comments" && docId && (
        <CommentsPanel
          token={token}
          docId={docId}
          editor={editor}
          me={me}
          canEdit={canEdit}
          activeMarkId={activeMarkId}
          draftMarkId={draftMarkId}
          onDraftDone={onDraftDone}
        />
      )}
    </aside>
  );
}
```

- [ ] **Step 5: CommentsPanel.tsx (read-only nesta task)**

Criar `frontend/src/CommentsPanel.tsx`:

```tsx
import type { Editor as TiptapEditor } from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";

import { listComments, type CommentOut, type MeOut } from "./api";

export function CommentsPanel({
  token,
  docId,
  editor,
  me,
  canEdit,
  activeMarkId,
  draftMarkId,
  onDraftDone,
}: {
  token: string;
  docId: string;
  editor: TiptapEditor | null;
  me: MeOut;
  canEdit: boolean;
  activeMarkId: string | null;
  draftMarkId: string | null;
  onDraftDone: () => void;
}) {
  const [comments, setComments] = useState<CommentOut[]>([]);
  const [err, setErr] = useState("");

  const reload = useCallback(() => {
    listComments(token, docId)
      .then(setComments)
      .catch((e) => setErr(String(e)));
  }, [token, docId]);

  useEffect(reload, [reload]);

  const roots = comments.filter((c) => c.parent_id === null);
  const repliesOf = (root: CommentOut) => comments.filter((c) => c.parent_id === root.id);

  function scrollToMark(markId: string) {
    document
      .querySelector(`span[data-comment-id="${markId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="panel">
      <h2>Comentários</h2>
      {err && <p className="err">{err}</p>}
      {roots.length === 0 && <p className="hint">Nenhum comentário neste documento.</p>}
      {roots.map((root) => (
        <div
          key={root.id}
          className={
            "comment-thread" +
            (root.mark_id === activeMarkId ? " active" : "") +
            (root.resolved ? " resolved" : "")
          }
          onClick={() => scrollToMark(root.mark_id)}
        >
          <div className="comment-item">
            <div className="comment-author">
              {root.author_name} · {new Date(root.created_at).toLocaleString("pt-BR")}
              {root.resolved ? " · resolvido" : ""}
            </div>
            <div className="comment-body">{root.body}</div>
          </div>
          {repliesOf(root).map((r) => (
            <div key={r.id} className="comment-item comment-reply">
              <div className="comment-author">
                {r.author_name} · {new Date(r.created_at).toLocaleString("pt-BR")}
              </div>
              <div className="comment-body">{r.body}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

(`editor`, `me`, `canEdit`, `draftMarkId`, `onDraftDone` ficam sem uso nesta
task — a Task 6 os consome. Se o tsc reclamar de unused, prefixar com `_` NO
DESTRUCTURING não é possível em props tipadas; usar `void editor; void me;
void canEdit; void draftMarkId; void onDraftDone;` na primeira linha do corpo
e remover na Task 6.)

- [ ] **Step 6: Editor.tsx — registrar CommentExtension + threading**

Em `frontend/src/Editor.tsx`:

Imports novos (após o import de `CharacterCount`):

```tsx
import { CommentExtension } from "@sereneinserenade/tiptap-comment-extension";
```

E no bloco de imports locais:

```tsx
import type { MeOut } from "./api";
```

Assinatura do componente `Editor` vira:

```tsx
export function Editor({
  token,
  docId,
  me,
  onEditorReady,
  onCanEdit,
  onCommentActivated,
  onNewComment,
}: {
  token: string;
  docId: string;
  me: MeOut;
  onEditorReady: (editor: import("@tiptap/react").Editor | null) => void;
  onCanEdit: (canEdit: boolean) => void;
  onCommentActivated: (markId: string | null) => void;
  onNewComment: (markId: string) => void;
}) {
```

No useEffect do título (que já chama `getDocument`), capturar também `can_edit`:

```tsx
  useEffect(() => {
    let alive = true;
    getDocument(token, docId)
      .then((d) => {
        if (!alive) return;
        setTitle(d.title);
        onCanEdit(d.can_edit);
      })
      .catch(() => alive && setTitle(""));
    return () => {
      alive = false;
    };
  }, [token, docId]);
```

Repassar para `EditorArea`:

```tsx
      <EditorArea
        key={docId}
        ydoc={conn.ydoc}
        docId={docId}
        onEditorReady={onEditorReady}
        onCommentActivated={onCommentActivated}
        onNewComment={onNewComment}
      />
```

`EditorArea` vira:

```tsx
function EditorArea({
  ydoc,
  docId,
  onEditorReady,
  onCommentActivated,
  onNewComment,
}: {
  ydoc: Y.Doc;
  docId: string;
  onEditorReady: (editor: import("@tiptap/react").Editor | null) => void;
  onCommentActivated: (markId: string | null) => void;
  onNewComment: (markId: string) => void;
}) {
```

(`onNewComment` só é repassado ao Toolbar na Task 6; nesta task, `void onNewComment;` na primeira linha do corpo.)

No array `extensions:`, após `TrackChangeExtension.configure({ enabled: false }),`:

```tsx
        CommentExtension.configure({
          HTMLAttributes: { class: "comment-mark" },
          onCommentActivated: (commentId: string) => onCommentActivated(commentId || null),
        }),
```

Após o `const editor = useEditor(...)`, adicionar:

```tsx
  useEffect(() => {
    onEditorReady(editor);
    return () => onEditorReady(null);
  }, [editor]);
```

(import de `useEffect` já existe no arquivo.)

- [ ] **Step 7: App.tsx — estado e render**

Em `frontend/src/App.tsx`:

Imports novos:

```tsx
import type { Editor as TiptapEditor } from "@tiptap/react";

import { fetchMe, type MeOut } from "./api";
import { Sidebar, type SidebarTab } from "./Sidebar";
```

(remover o import de `AiSidebar` — quem o renderiza agora é o Sidebar.)

Estado novo dentro de `App`:

```tsx
  const [me, setMe] = useState<MeOut | null>(null);
  const [editorInst, setEditorInst] = useState<TiptapEditor | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [tab, setTab] = useState<SidebarTab>("ia");
  const [activeMarkId, setActiveMarkId] = useState<string | null>(null);
  const [draftMarkId, setDraftMarkId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setMe(null);
      return;
    }
    fetchMe(token).then(setMe).catch(() => {});
  }, [token]);
```

No `logout()`, adicionar resets:

```tsx
    setMe(null);
    setTab("ia");
    setActiveMarkId(null);
    setDraftMarkId(null);
    setCanEdit(false);
```

No `openDoc`, resetar estado por-documento:

```tsx
  function openDoc(id: string) {
    setDocInput(id);
    setDocId(id);
    setActiveMarkId(null);
    setDraftMarkId(null);
    setCanEdit(false);
  }
```

Gate no render (depois do `if (!token) return <Login .../>`):

```tsx
  if (!me) return <p className="hint">Carregando usuario...</p>;
```

O `<main>` vira:

```tsx
      <main>
        {docId ? (
          <Editor
            token={token}
            docId={docId}
            me={me}
            onEditorReady={setEditorInst}
            onCanEdit={setCanEdit}
            onCommentActivated={(markId) => {
              setActiveMarkId(markId);
              if (markId) setTab("comments");
            }}
            onNewComment={(markId) => {
              setDraftMarkId(markId);
              setActiveMarkId(markId);
              setTab("comments");
            }}
          />
        ) : (
          <p className="hint">Abra um doc existente (por id) ou crie um novo.</p>
        )}
        <Sidebar
          token={token}
          docId={docId}
          editor={editorInst}
          me={me}
          canEdit={canEdit}
          tab={tab}
          onTab={setTab}
          activeMarkId={activeMarkId}
          draftMarkId={draftMarkId}
          onDraftDone={() => setDraftMarkId(null)}
          onOpenDoc={openDoc}
        />
      </main>
```

- [ ] **Step 8: CSS**

Ao final de `frontend/src/styles.css`:

```css
/* Sidebar em abas (comentarios & track changes) */
.sidebar-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 10px;
}
.sidebar-tabs button {
  flex: 1;
  font-size: 12px;
}
.sidebar-tabs button.active {
  background: #2a3346;
}

/* Mark de comentario no editor */
.prose span[data-comment-id] {
  background: rgba(250, 204, 21, 0.15);
  border-bottom: 1px dashed #facc15;
  cursor: pointer;
}

/* Threads de comentario */
.comment-thread {
  border: 1px solid #2a3346;
  border-radius: 8px;
  padding: 8px;
  margin-bottom: 8px;
  cursor: pointer;
}
.comment-thread.active {
  border-color: #facc15;
}
.comment-thread.resolved {
  opacity: 0.55;
}
.comment-item {
  margin-bottom: 6px;
}
.comment-author {
  font-size: 11px;
  color: #8b93a7;
}
.comment-body {
  font-size: 13px;
  white-space: pre-wrap;
}
.comment-reply {
  margin-left: 12px;
  border-left: 2px solid #2a3346;
  padding-left: 8px;
}
```

- [ ] **Step 9: Typecheck + verificação manual**

```bash
cd frontend && npm run typecheck
```

Esperado: PASS.

Browser em `http://localhost:5173` (login `engineer_lead`):
1. Sidebar mostra abas **IA | Comentários**; IA funciona como antes (fazer 1 pergunta).
2. Sem doc aberto: aba Comentários desabilitada.
3. Abrir um doc: aba Comentários habilita; clicar → "Nenhum comentário neste documento."
4. Criar um comentário via API direto (evidência de hidratação):
   no console: `fetch('http://localhost:8000/api/documents/<DOC>/comments', {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+localStorage.getItem('nyx_token')}, body: JSON.stringify({mark_id:'33333333-3333-3333-3333-333333333333', body:'teste de hidratacao'})})` → recarregar a página, abrir o doc, aba Comentários → thread aparece com autor e corpo.
5. Console sem erros.

- [ ] **Step 10: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/api.ts frontend/src/Sidebar.tsx frontend/src/CommentsPanel.tsx frontend/src/AiSidebar.tsx frontend/src/App.tsx frontend/src/Editor.tsx frontend/src/styles.css
git commit -m "feat(comments): comment extension, tabbed sidebar, read-only thread list"
```

---

### Task 6: Frontend — fluxo completo de comentários

**Files:**
- Modify: `frontend/src/Toolbar.tsx` (botão 💬 + props novas)
- Modify: `frontend/src/Editor.tsx` (repassar `canEdit`/`onNewComment` ao Toolbar)
- Modify: `frontend/src/CommentsPanel.tsx` (composer, reply, resolver, apagar)
- Modify: `frontend/src/styles.css` (composer/ações)

**Interfaces:**
- Consumes: `createComment`/`updateComment`/`deleteComment` (Task 5), `editor.chain().focus().setComment(id).run()` / `editor.commands.unsetComment(id)`, `crypto.randomUUID()` (nativo, sem dependência), `onNewComment` prop (Task 5).
- Produces: `Toolbar` props novas: `canEdit: boolean; onNewComment: (markId: string) => void;` (a Task 7 adiciona mais 2).

- [ ] **Step 1: Toolbar — botão 💬**

Em `frontend/src/Toolbar.tsx`, assinatura vira:

```tsx
export function Toolbar({
  editor,
  docId,
  canEdit,
  onNewComment,
}: {
  editor: Editor;
  docId: string;
  canEdit: boolean;
  onNewComment: (markId: string) => void;
}) {
```

Na row 2, logo após o botão Link (`{btn("🔗", ...)}`) e antes do bloco condicional `{editor.isActive("table") && (...)}`:

```tsx
        {btn(
          "💬",
          canEdit ? "Comentar (selecione um texto)" : "Comentar (requer permissão de edição)",
          () => {
            if (editor.state.selection.empty) return;
            const markId = crypto.randomUUID();
            editor.chain().focus().setComment(markId).run();
            onNewComment(markId);
          },
          false,
          !canEdit,
        )}
```

- [ ] **Step 2: Editor.tsx — repassar props**

Em `Editor` (componente pai), repassar `canEdit` para `EditorArea`. `Editor` já
recebe `onCanEdit`; adicionar estado local:

```tsx
  const [canEdit, setCanEdit] = useState(false);
```

No `.then((d) => {...})` do getDocument, além de `onCanEdit(d.can_edit)`:

```tsx
        setCanEdit(d.can_edit);
```

Repassar em `<EditorArea ... canEdit={canEdit} />` e na assinatura de `EditorArea` adicionar `canEdit: boolean;`. Remover o `void onNewComment;` da Task 5 e passar ao Toolbar:

```tsx
      <Toolbar editor={editor} docId={docId} canEdit={canEdit} onNewComment={onNewComment} />
```

- [ ] **Step 3: CommentsPanel — composer/reply/resolver/apagar**

Substituir `frontend/src/CommentsPanel.tsx` inteiro por:

```tsx
import type { Editor as TiptapEditor } from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";

import {
  createComment,
  deleteComment,
  listComments,
  updateComment,
  type CommentOut,
  type MeOut,
} from "./api";

export function CommentsPanel({
  token,
  docId,
  editor,
  me,
  canEdit,
  activeMarkId,
  draftMarkId,
  onDraftDone,
}: {
  token: string;
  docId: string;
  editor: TiptapEditor | null;
  me: MeOut;
  canEdit: boolean;
  activeMarkId: string | null;
  draftMarkId: string | null;
  onDraftDone: () => void;
}) {
  const [comments, setComments] = useState<CommentOut[]>([]);
  const [draftBody, setDraftBody] = useState("");
  const [replyFor, setReplyFor] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [err, setErr] = useState("");

  const reload = useCallback(() => {
    listComments(token, docId)
      .then(setComments)
      .catch((e) => setErr(String(e)));
  }, [token, docId]);

  useEffect(reload, [reload]);

  const roots = comments.filter((c) => c.parent_id === null);
  const repliesOf = (root: CommentOut) => comments.filter((c) => c.parent_id === root.id);
  const canTouch = (c: CommentOut) => canEdit || c.author_id === me.id;

  function scrollToMark(markId: string) {
    document
      .querySelector(`span[data-comment-id="${markId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function submitDraft() {
    if (!draftMarkId || !draftBody.trim()) return;
    try {
      await createComment(token, docId, { mark_id: draftMarkId, body: draftBody.trim() });
      setDraftBody("");
      onDraftDone();
      reload();
    } catch (e) {
      setErr(String(e));
    }
  }

  function cancelDraft() {
    if (draftMarkId) editor?.commands.unsetComment(draftMarkId);
    setDraftBody("");
    onDraftDone();
  }

  async function submitReply(root: CommentOut) {
    if (!replyBody.trim()) return;
    try {
      await createComment(token, docId, {
        mark_id: root.mark_id,
        body: replyBody.trim(),
        parent_id: root.id,
      });
      setReplyBody("");
      setReplyFor(null);
      reload();
    } catch (e) {
      setErr(String(e));
    }
  }

  async function toggleResolved(root: CommentOut) {
    try {
      await updateComment(token, root.id, { resolved: !root.resolved });
      reload();
    } catch (e) {
      setErr(String(e));
    }
  }

  async function removeThread(root: CommentOut) {
    try {
      await deleteComment(token, root.id); // cascade apaga replies
      editor?.commands.unsetComment(root.mark_id);
      reload();
    } catch (e) {
      setErr(String(e));
    }
  }

  return (
    <div className="panel">
      <h2>Comentários</h2>
      {err && <p className="err">{err}</p>}

      {draftMarkId && (
        <div className="comment-thread active comment-composer">
          <textarea
            autoFocus
            placeholder="Escreva o comentário..."
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
          />
          <div className="comment-actions">
            <button onClick={submitDraft} disabled={!draftBody.trim()}>
              Comentar
            </button>
            <button className="ghost" onClick={cancelDraft}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {roots.length === 0 && !draftMarkId && (
        <p className="hint">Nenhum comentário neste documento.</p>
      )}

      {roots.map((root) => (
        <div
          key={root.id}
          className={
            "comment-thread" +
            (root.mark_id === activeMarkId ? " active" : "") +
            (root.resolved ? " resolved" : "")
          }
          onClick={() => scrollToMark(root.mark_id)}
        >
          <div className="comment-item">
            <div className="comment-author">
              {root.author_name} · {new Date(root.created_at).toLocaleString("pt-BR")}
              {root.resolved ? " · resolvido" : ""}
            </div>
            <div className="comment-body">{root.body}</div>
          </div>

          {repliesOf(root).map((r) => (
            <div key={r.id} className="comment-item comment-reply">
              <div className="comment-author">
                {r.author_name} · {new Date(r.created_at).toLocaleString("pt-BR")}
              </div>
              <div className="comment-body">{r.body}</div>
            </div>
          ))}

          <div className="comment-actions" onClick={(e) => e.stopPropagation()}>
            {canEdit && (
              <button onClick={() => setReplyFor(replyFor === root.id ? null : root.id)}>
                Responder
              </button>
            )}
            {canTouch(root) && (
              <button onClick={() => toggleResolved(root)}>
                {root.resolved ? "Reabrir" : "Resolver"}
              </button>
            )}
            {canTouch(root) && (
              <button className="ghost" onClick={() => removeThread(root)}>
                Apagar
              </button>
            )}
          </div>

          {replyFor === root.id && (
            <div className="comment-composer" onClick={(e) => e.stopPropagation()}>
              <textarea
                autoFocus
                placeholder="Responder..."
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
              />
              <div className="comment-actions">
                <button onClick={() => submitReply(root)} disabled={!replyBody.trim()}>
                  Enviar
                </button>
                <button className="ghost" onClick={() => setReplyFor(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: CSS do composer**

Ao final de `frontend/src/styles.css`:

```css
/* Composer de comentario */
.comment-composer textarea {
  width: 100%;
  min-height: 56px;
  resize: vertical;
  margin-bottom: 6px;
}
.comment-actions {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}
.comment-actions button {
  font-size: 11px;
}
```

- [ ] **Step 5: Typecheck + E2E manual (roteiro do spec)**

```bash
cd frontend && npm run typecheck
```

Browser (`engineer_lead`, doc de teste):
1. Digitar um parágrafo, selecionar um trecho, clicar 💬 → trecho ganha fundo amarelo (`span[data-comment-id]`), sidebar abre na aba Comentários com composer.
2. Escrever "primeira thread" → **Comentar** → thread aparece na lista.
3. **Cancelar** um segundo draft → mark é removido do texto (sem fundo amarelo órfão).
4. **Responder** → reply aparece indentada na thread.
5. **Resolver** → thread fica opaca com "· resolvido"; **Reabrir** desfaz.
6. Clicar na thread → editor rola até o trecho marcado.
7. Clicar no trecho marcado no editor → `onCommentActivated` dispara, thread ganha borda amarela (`.active`).
8. **Apagar** → thread some da lista E o fundo amarelo some do texto.
9. Logar como `engineer_l1` (registrar `cm_viewer@test.com` se preciso) e abrir o mesmo doc: aba Comentários lista threads; botão 💬 desabilitado; sem botões Responder/Resolver/Apagar.
10. Console sem erros nas duas sessões.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/Toolbar.tsx frontend/src/Editor.tsx frontend/src/CommentsPanel.tsx frontend/src/styles.css
git commit -m "feat(comments): create/reply/resolve/delete threads with editor anchoring"
```

---

### Task 7: Frontend — Track Changes UI com amarração ABAC

**Files:**
- Modify: `frontend/src/Editor.tsx` (atribuição, estado suggesting, forced-on p/ viewer)
- Modify: `frontend/src/Toolbar.tsx` (toggle "Modo sugestão")
- Create: `frontend/src/SuggestionsPanel.tsx`
- Modify: `frontend/src/Sidebar.tsx` (aba Sugestões, só canEdit)
- Modify: `frontend/src/styles.css` (insert/delete + painel)

**Interfaces:**
- Consumes: `TrackChangeExtension` (Task 1) — comandos `setTrackChangeStatus(enabled)`, `acceptChange()`, `acceptAllChanges()`, `rejectChange()`, `rejectAllChanges()`; marks `insertion`/`deletion` com attrs `data-op-user-id`/`data-op-user-nickname` (attrs com hífen, acessar via `mark.attrs["data-op-user-nickname"]`); `me: MeOut` e `canEdit` (Tasks 5-6).
- Produces: `Toolbar` props finais: `{ editor, docId, canEdit, onNewComment, suggesting: boolean, onToggleSuggesting: () => void }`; `SuggestionsPanel { editor: TiptapEditor }`.

- [ ] **Step 1: Editor.tsx — atribuição + modo sugestão**

Em `EditorArea` (que agora recebe `me: MeOut` — adicionar à assinatura e repassar de `Editor`):

Trocar `TrackChangeExtension.configure({ enabled: false }),` por:

```tsx
        TrackChangeExtension.configure({
          enabled: false, // ligado via setTrackChangeStatus no useEffect abaixo
          dataOpUserId: String(me.id),
          dataOpUserNickname: me.full_name ?? me.email,
        }),
```

Estado + efeito (dentro de `EditorArea`, após `const editor = useEditor(...)`):

```tsx
  const [suggesting, setSuggesting] = useState(false);

  // ABAC: viewer (sem edit) fica SEMPRE em modo sugestao; editor decide pelo toggle
  useEffect(() => {
    if (!editor) return;
    editor.commands.setTrackChangeStatus(!canEdit || suggesting);
  }, [editor, canEdit, suggesting]);
```

(import de `useState` já existe.)

Repassar ao Toolbar:

```tsx
      <Toolbar
        editor={editor}
        docId={docId}
        canEdit={canEdit}
        onNewComment={onNewComment}
        suggesting={!canEdit || suggesting}
        onToggleSuggesting={() => setSuggesting((v) => !v)}
      />
```

- [ ] **Step 2: Toolbar — toggle "Modo sugestão"**

Assinatura ganha:

```tsx
  suggesting: boolean;
  onToggleSuggesting: () => void;
```

Na row 1, após os botões Undo/Redo:

```tsx
        <span className="sep" />

        {btn(
          "✎ Sugestão",
          canEdit
            ? "Modo sugestão: suas edições viram sugestões para aceitar/rejeitar"
            : "Modo sugestão sempre ativo: você não tem permissão de edição direta",
          () => canEdit && onToggleSuggesting(),
          suggesting,
          !canEdit,
        )}
```

- [ ] **Step 3: SuggestionsPanel.tsx**

Criar `frontend/src/SuggestionsPanel.tsx`:

```tsx
import type { Editor as TiptapEditor } from "@tiptap/react";
import { useEffect, useReducer } from "react";

interface Change {
  from: number;
  to: number;
  type: "insertion" | "deletion";
  author: string;
  text: string;
}

function collectChanges(editor: TiptapEditor): Change[] {
  const out: Change[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      if (mark.type.name !== "insertion" && mark.type.name !== "deletion") continue;
      const type = mark.type.name as Change["type"];
      const author = (mark.attrs["data-op-user-nickname"] as string) || "?";
      const last = out[out.length - 1];
      // funde trechos contiguos do mesmo tipo/autor num item so
      if (last && last.to === pos && last.type === type && last.author === author) {
        last.to = pos + node.nodeSize;
        last.text += node.text ?? "";
      } else {
        out.push({ from: pos, to: pos + node.nodeSize, type, author, text: node.text ?? "" });
      }
    }
  });
  return out;
}

export function SuggestionsPanel({ editor }: { editor: TiptapEditor | null }) {
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    if (!editor) return;
    editor.on("transaction", force);
    return () => {
      editor.off("transaction", force);
    };
  }, [editor]);

  if (!editor) return <p className="hint">Abra um documento.</p>;

  const changes = collectChanges(editor);

  function act(c: Change, accept: boolean) {
    if (!editor) return;
    const chain = editor.chain().focus().setTextSelection({ from: c.from, to: c.to });
    if (accept) chain.acceptChange().run();
    else chain.rejectChange().run();
  }

  return (
    <div className="panel">
      <h2>Sugestões</h2>
      {changes.length > 0 && (
        <div className="suggestion-all">
          <button onClick={() => editor.chain().focus().acceptAllChanges().run()}>
            Aceitar todas
          </button>
          <button className="ghost" onClick={() => editor.chain().focus().rejectAllChanges().run()}>
            Rejeitar todas
          </button>
        </div>
      )}
      {changes.length === 0 && <p className="hint">Nenhuma sugestão pendente.</p>}
      {changes.map((c, i) => (
        <div key={`${c.from}-${i}`} className="suggestion-item">
          <div className="suggestion-type">
            {c.type === "insertion" ? "Inserção" : "Remoção"} · {c.author}
          </div>
          <div className="suggestion-text">{c.text}</div>
          <div className="comment-actions">
            <button onClick={() => act(c, true)}>Aceitar</button>
            <button className="ghost" onClick={() => act(c, false)}>
              Rejeitar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Sidebar — aba Sugestões (só canEdit)**

Em `frontend/src/Sidebar.tsx`, import:

```tsx
import { SuggestionsPanel } from "./SuggestionsPanel";
```

No `.sidebar-tabs`, substituir o comentário placeholder por:

```tsx
        {canEdit && (
          <button
            className={tab === "suggestions" ? "active" : ""}
            onClick={() => onTab("suggestions")}
            disabled={!docId}
            title="Sugestões pendentes (track changes)"
          >
            Sugestões
          </button>
        )}
```

Após o bloco da aba comments:

```tsx
      {tab === "suggestions" && docId && canEdit && <SuggestionsPanel editor={editor} />}
```

- [ ] **Step 5: CSS**

Ao final de `frontend/src/styles.css`:

```css
/* Track changes: insercao verde sublinhada, delecao vermelha tachada (convencao Word/GDocs) */
.prose insert {
  color: #4ade80;
  text-decoration: underline;
}
.prose delete {
  color: #e24b4a;
  text-decoration: line-through;
}

/* Painel de sugestoes */
.suggestion-all {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}
.suggestion-item {
  border: 1px solid #2a3346;
  border-radius: 8px;
  padding: 8px;
  margin-bottom: 8px;
}
.suggestion-type {
  font-size: 11px;
  color: #8b93a7;
}
.suggestion-text {
  font-size: 13px;
}
```

- [ ] **Step 6: Typecheck + E2E manual (roteiro do spec)**

```bash
cd frontend && npm run typecheck
```

Browser:
1. **Editor** (`engineer_lead`, doc próprio): toggle "✎ Sugestão" visível e habilitado, inicialmente desligado. Digitar → texto normal (sem `<insert>`).
2. Ligar o toggle → digitar "texto sugerido" → verde sublinhado (`.prose insert`); deletar um trecho existente → vermelho tachado (`.prose delete`), texto não some.
3. Aba **Sugestões** lista os 2 itens com tipo + autor (nickname = full_name/email do lead).
4. **Aceitar** individual na inserção → vira texto normal, item some da lista.
5. **Rejeitar** individual na deleção → texto restaurado, item some.
6. Repetir 2 e usar **Aceitar todas** / **Rejeitar todas** → lista zera, doc consistente.
7. **Viewer** (`engineer_l1`, doc do lead): toggle aparece ATIVO e DESABILITADO com tooltip explicando; digitar → vira sugestão automaticamente (verde); aba Sugestões NÃO existe pra ele.
8. De volta como lead: sugestão do viewer aparece na aba Sugestões com o nome do viewer; aceitar → texto vira definitivo.
9. 2 abas (lead + viewer) simultâneas: sugestões sincronizam ao vivo, aceitar na aba do lead reflete na do viewer, sem erros de console (revalida o spike com a UI real).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/Editor.tsx frontend/src/Toolbar.tsx frontend/src/SuggestionsPanel.tsx frontend/src/Sidebar.tsx frontend/src/styles.css
git commit -m "feat(track-changes): suggestion mode with ABAC gating, suggestions panel"
```

---

## Self-Review (executado na escrita do plano)

**Cobertura do spec:**
- Tabela `comments` (todas as colunas do spec) → Task 2. ✓
- 4 endpoints com autz view/edit/autor-ou-edit → Task 3. ✓
- `CommentExtension` + `onCommentActivated` + botão 💬 + sidebar em abas + hidratação + reply/resolver/apagar → Tasks 5-6. ✓
- `can_edit` (spec: `canEdit`; desvio snake_case documentado em Global Constraints) → Task 4. ✓
- Track changes: atribuição, viewer sempre-sugestão, toggle p/ editor, painel aceitar/rejeitar individual e em massa, CSS verde/vermelho → Task 7. ✓
- Spike Y.js/Collaboration como PRIMEIRA task com gate GO/NO-GO → Task 1. ✓
- Testes do spec: migration upgrade/downgrade (T2 Step 4), curl 2 papéis (T3 Step 4, T4 Step 3), spike 2 abas (T1 Step 5), tsc (todas), E2E manual completo (T6 Step 5, T7 Step 6). ✓
- Fora de escopo respeitado (sem conflito automático, notificações, menções). ✓

**Placeholders:** nenhum — todo step tem código/comando/saída esperada.

**Consistência de tipos:** `acceptAllChanges`/`rejectAllChanges` (plural, API real) usados em T1/T7; `CommentOut` idêntico em T3 (pydantic) e T5 (TS); props de `Toolbar` evoluem T6→T7 com assinatura final única; `SidebarTab` inclui `"suggestions"` desde T5 (aba só renderiza em T7 — deliberado, evita quebrar o union type depois).

**Notas de risco:**
- Mark de comentário órfão (thread apagada em outra sessão deixa o mark no Y.doc): fora de escopo, conhecido; `unsetComment` cobre o caminho normal.
- Attrs com hífen nos marks do track-change (`data-op-user-nickname`) — acessar com colchetes, nunca dot-notation.
- `window.__editor` do spike NUNCA commitado (T1 Step 6 remove).
