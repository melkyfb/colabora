# frontend — Cliente (Fase 5)

React + TypeScript + Vite + Tiptap + Y.js. Prova a integração End-to-End.

## O que faz

- **Login** (REST → FastAPI `/api/auth/login`, guarda o JWT no localStorage).
- **Editor colaborativo**: Tiptap + `Collaboration` (Y.js) + `HocuspocusProvider`
  conectando **DIRETO** ao realtime-server via WebSocket (`ws://localhost:1234`),
  passando o token. `documentName == id do Document`.
- **Assistente IA** (sidebar): chat → `POST /api/rag/chat` (RAG + LLM configurável).

## Rodar (dockerizado)

A partir da raiz do monorepo:

```bash
docker compose up -d --build frontend
```

Abre em http://localhost:5173

## Rodar local

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm run typecheck    # tsc --noEmit
```

## Env (build/runtime — lidas pelo browser)

| Var           | Default                 |
|---------------|-------------------------|
| VITE_API_URL  | http://localhost:8000   |
| VITE_WS_URL   | ws://localhost:1234     |

## Fluxo E2E

1. Registra/loga (escolhe role: engineer_l1 / engineer_lead / admin).
2. "Novo doc" cria via REST no FastAPI (vira owner).
3. Abre o editor → WS conecta ao Hocuspocus → `onAuthenticate` valida no FastAPI+Cerbos.
4. Digita em tempo real (sincroniza via Redis entre instâncias).
5. Ao parar, o `extension-webhook` do Node salva o estado final no MySQL.
6. Sidebar IA responde perguntas cruzando OpenSearch (RAG) com permissões Cerbos.
