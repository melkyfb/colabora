# realtime-server — Via Expressa (Fase 3)

Node.js + TypeScript + Hocuspocus. Servidor de WebSockets pra edicao colaborativa
via CRDT (Y.js/Tiptap). O frontend conecta **DIRETO** aqui — nunca passa pelo FastAPI.

## O que faz

- **Hocuspocus** escutando WS na porta `1234`.
- **extension-redis**: sincroniza estado entre instancias (scale-out horizontal via pub/sub).
- **extension-webhook**: ao editar (evento `onChange`, com debounce), manda POST
  assinado (HMAC-SHA256) pro FastAPI persistir o estado final no MySQL.
- **onAuthenticate**: consulta `POST /api/internal/authorize` do FastAPI (que decodifica
  o JWT e chama o Cerbos). Conexao WS so entra com token valido + permissao `view`.

O realtime-server nao decodifica JWT nem fala com o Cerbos direto — auth mora so no FastAPI.

## Rodar (dockerizado)

A partir da raiz do monorepo:

```bash
docker compose up -d --build realtime-server
docker compose logs -f realtime-server
```

## Rodar local

```bash
cd realtime-server
npm install
npm run dev        # tsx watch
npm run typecheck  # tsc --noEmit
```

## Env

| Var                        | Default (compose)                              |
|----------------------------|------------------------------------------------|
| HOCUSPOCUS_PORT            | 1234                                           |
| REDIS_HOST / REDIS_PORT    | redis / 6379                                   |
| FASTAPI_INTERNAL_URL       | http://backend-api:8000                        |
| WEBHOOK_URL                | http://backend-api:8000/api/webhooks/hocuspocus|
| INTERNAL_API_KEY           | (compartilhado com o FastAPI)                  |
| HOCUSPOCUS_WEBHOOK_SECRET  | (compartilhado com o FastAPI)                  |

## Fluxo de conexao

```
Frontend (HocuspocusProvider, token JWT)
   │  WS  documentName=<id do Document>
   ▼
realtime-server.onAuthenticate ── POST /api/internal/authorize (X-Internal-Key)
   │                                     │ FastAPI: decode JWT + Cerbos check("view")
   │ allowed? ◄───────────────────────── │
   ▼ sim: aceita WS e sincroniza via Redis
   ... ao editar ──► extension-webhook ──► POST /api/webhooks/hocuspocus (HMAC) ──► MySQL
```
