# backend-api — Motor Principal (Fase 2)

FastAPI + SQLAlchemy 2.0 (async) + Alembic + Cerbos (ABAC) + JWT.
Gatekeeper REST da plataforma. **NAO** faz proxy de WebSocket.

## Rodar (dockerizado)

A partir da raiz do monorepo:

```bash
docker compose up -d --build          # sobe infra + backend-api
docker compose run --rm backend-api alembic upgrade head   # migrations no MySQL
```

API em http://localhost:8000 · Swagger em http://localhost:8000/docs

## Rodar local (sem Docker, contra a infra dockerizada)

```bash
cd backend-api
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
# defaults do config.py ja apontam pra localhost:3306 / :3592
alembic upgrade head
uvicorn app.main:app --reload
```

## Estrutura

```
app/
├── main.py           # app + routers + /health
├── config.py         # settings via env (pydantic-settings)
├── db.py             # engine/session async
├── models/           # User, Document, Permission
├── schemas/          # pydantic (auth, document)
├── auth/             # security (bcrypt+JWT) + deps (get_current_user)
├── cerbos/           # client httpx -> /api/check/resources
└── routers/          # auth, documents, webhooks
alembic/              # migrations (0001_initial)
tests/                # test_security.py (roda sem infra)
```

## Endpoints

| Metodo | Rota                      | Auth | Cerbos      |
|--------|---------------------------|------|-------------|
| POST   | /api/auth/register        | —    | —           |
| POST   | /api/auth/login           | —    | —           |
| GET    | /api/auth/me              | JWT  | —           |
| POST   | /api/documents            | JWT  | — (vira owner) |
| GET    | /api/documents/{id}       | JWT  | view        |
| PUT    | /api/documents/{id}       | JWT  | edit        |
| DELETE | /api/documents/{id}       | JWT  | delete      |
| POST   | /api/webhooks/hocuspocus  | HMAC | —           |

## Autorizacao (ABAC via Cerbos)

FastAPI monta `principal` (id + roles) e `resource` (kind=document, attr.ownerId),
chama `POST {CERBOS_HTTP_URL}/api/check/resources`. Policies em
`infra/cerbos/policies/`. Roles: `engineer_l1` (le), `engineer_lead` (le+escreve),
`admin` (tudo), `owner` (ABAC, dono do doc).

Roles do usuario num doc = `user.role` (global) ∪ `permissions.role` (por-doc).

## Webhook Hocuspocus

`POST /api/webhooks/hocuspocus` recebe eventos do `@hocuspocus/extension-webhook`
(Fase 3), verifica HMAC-SHA256 (`X-Hocuspocus-Signature-256`) com
`HOCUSPOCUS_WEBHOOK_SECRET`, e persiste o estado final no MySQL. Convencao:
`documentName == id do Document`.

## Testes

```bash
pip install -e ".[dev]"
pytest -q          # test_security roda sem DB/infra
```
