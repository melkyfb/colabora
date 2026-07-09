# Graph Report - colabora  (2026-07-08)

## Corpus Check
- 54 files · ~6,418 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 274 nodes · 347 edges · 45 communities (30 shown, 15 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 45 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `be35260d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Autenticacao JWT & Auth Router
- Arquitetura Dual-Stack (Dominio)
- Documentos: Modelos & CRUD
- Config, Cerbos Client & Alembic
- DB Session, Deps & Webhook
- Autorizacao ABAC & Papeis (Cerbos)
- Base ORM & Permissions
- Schemas de Documento
- App Entrypoint (main/health)
- Pacote nyx-backend-api
- package.json
- api.ts
- compilerOptions
- compilerOptions
- backend-api — Motor Principal (Fase 2)
- CerbosClient
- frontend — Cliente (Fase 5)
- realtime-server — Via Expressa (Fase 3)
- auth.ts
- Nyx Platform — Data Management Platform (PoC)
- Cerbos httpx Client (/api/check/resources)
- JWT + bcrypt Auth
- Redis (Hocuspocus Pub/Sub)
- React + Tiptap + Y.js Frontend
- Tiptap Editor
- Y.js CRDT
- Dual-Stack Architecture
- Hard Rule: FastAPI Never Proxies WebSocket
- Nyx Platform (PoC)
- Real-Time Lane (CRDT)
- Hocuspocus realtime-server
- onAuthenticate Hook
- onStoreDocument Hook
- Redis Pub/Sub Scale-Out (@hocuspocus/extension-redis)

## God Nodes (most connected - your core abstractions)
1. `User` - 25 edges
2. `compilerOptions` - 14 edges
3. `Document` - 11 edges
4. `ingest()` - 10 edges
5. `_authorize()` - 9 edges
6. `compilerOptions` - 9 edges
7. `authorize()` - 8 edges
8. `backend-api — Motor Principal (Fase 2)` - 8 edges
9. `login()` - 7 edges
10. `_get_or_404()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Document Resource Policy` --implements--> `Document Resource`  [INFERRED]
  infra/cerbos/policies/document.yaml → backend-api/README.md
- `OpenSearch (Vector DB / RAG)` --implements--> `Processing/AI Lane`  [INFERRED]
  docker-compose.yml → README.md
- `FastAPI backend-api (REST Gatekeeper)` --calls--> `OpenSearch (Vector DB / RAG)`  [INFERRED]
  backend-api/README.md → docker-compose.yml
- `Cerbos ABAC Authorization` --references--> `Document Resource Policy`  [EXTRACTED]
  docker-compose.yml → infra/cerbos/policies/document.yaml
- `get_current_user()` --calls--> `decode_token()`  [INFERRED]
  backend-api/app/auth/deps.py → backend-api/app/auth/security.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Document Role Hierarchy (l1/lead/admin/owner)** — infra_cerbos_policies_document_engineer_l1_role, infra_cerbos_policies_document_engineer_lead_role, infra_cerbos_policies_document_admin_role, infra_cerbos_policies_derived_roles_owner_role [EXTRACTED 0.85]

## Communities (45 total, 15 thin omitted)

### Community 0 - "Autenticacao JWT & Auth Router"
Cohesion: 0.15
Nodes (16): create_access_token(), decode_token(), hash_password(), verify_password(), login(), me(), AsyncSession, register() (+8 more)

### Community 1 - "Arquitetura Dual-Stack (Dominio)"
Cohesion: 0.50
Nodes (4): FastAPI backend-api (REST Gatekeeper), MySQL (Final Document State), OpenSearch (Vector DB / RAG), Processing/AI Lane

### Community 2 - "Documentos: Modelos & CRUD"
Cohesion: 0.28
Nodes (13): Document, _authorize(), create_document(), delete_document(), get_document(), _get_or_404(), AsyncSession, _roles_for() (+5 more)

### Community 3 - "Config, Cerbos Client & Alembic"
Cohesion: 0.11
Nodes (13): _do_run_migrations(), run_migrations_online(), Settings, get_embeddings(), Embeddings selecionadas por env. Carrega uma vez (modelo local e pesado)., get_llm(), Chat LLM selecionado por env. Carrega uma vez.      Providers: claude (default), add_chunks() (+5 more)

### Community 4 - "DB Session, Deps & Webhook"
Cohesion: 0.20
Nodes (8): get_current_user(), AsyncSession, get_db(), AsyncSession, hocuspocus_webhook(), AsyncSession, _verify_signature(), Request

### Community 5 - "Autorizacao ABAC & Papeis (Cerbos)"
Cohesion: 0.33
Nodes (9): Document Resource, Cerbos ABAC Authorization, Cerbos Server Config (disk storage, hot-reload), common_roles Derived Roles, owner derived role (ABAC ownerId condition), admin role (all actions), engineer_l1 role (read/view), engineer_lead role (read+write) (+1 more)

### Community 6 - "Base ORM & Permissions"
Cohesion: 0.20
Nodes (10): Base, TimestampMixin, Permission, authorize(), AuthorizeRequest, AuthorizeResponse, AsyncSession, BaseModel (+2 more)

### Community 7 - "Schemas de Documento"
Cohesion: 0.08
Nodes (24): dependencies, @hocuspocus/provider, react, react-dom, @tiptap/extension-collaboration, @tiptap/pm, @tiptap/react, @tiptap/starter-kit (+16 more)

### Community 9 - "App Entrypoint (main/health)"
Cohesion: 0.20
Nodes (17): User, pdf_to_text(), split_text(), ChatRequest, ChatResponse, ingest(), IngestResponse, AsyncSession (+9 more)

### Community 18 - "package.json"
Cohesion: 0.10
Nodes (19): dependencies, @hocuspocus/extension-redis, @hocuspocus/extension-webhook, @hocuspocus/server, @hocuspocus/transformer, yjs, devDependencies, tsx (+11 more)

### Community 19 - "api.ts"
Cohesion: 0.21
Nodes (10): AiSidebar(), ChatReply, ChatSource, createDocument(), login(), ragChat(), register(), App() (+2 more)

### Community 20 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noUnusedLocals (+7 more)

### Community 21 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, outDir, skipLibCheck, strict, target (+2 more)

### Community 22 - "backend-api — Motor Principal (Fase 2)"
Cohesion: 0.22
Nodes (8): Autorizacao (ABAC via Cerbos), backend-api — Motor Principal (Fase 2), Endpoints, Estrutura, Rodar (dockerizado), Rodar local (sem Docker, contra a infra dockerizada), Testes, Webhook Hocuspocus

### Community 23 - "CerbosClient"
Cohesion: 0.29
Nodes (3): CerbosClient, 1 CheckResources p/ N recursos. resources: [{'id':..., 'attr':{...}}, ...]., Cliente fino sobre a API REST do Cerbos (POST /api/check/resources).      ponyta

### Community 24 - "frontend — Cliente (Fase 5)"
Cohesion: 0.29
Nodes (6): Env (build/runtime — lidas pelo browser), Fluxo E2E, frontend — Cliente (Fase 5), O que faz, Rodar (dockerizado), Rodar local

### Community 25 - "realtime-server — Via Expressa (Fase 3)"
Cohesion: 0.29
Nodes (6): Env, Fluxo de conexao, O que faz, realtime-server — Via Expressa (Fase 3), Rodar (dockerizado), Rodar local

### Community 26 - "auth.ts"
Cohesion: 0.48
Nodes (4): authorizeConnection(), AuthzResult, config, server

### Community 27 - "Nyx Platform — Data Management Platform (PoC)"
Cohesion: 0.50
Nodes (3): Estrutura, Fase 1 — subir a infra local, Nyx Platform — Data Management Platform (PoC)

## Knowledge Gaps
- **101 isolated node(s):** `nyx-backend-api`, `name`, `private`, `version`, `type` (+96 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `User` connect `App Entrypoint (main/health)` to `Autenticacao JWT & Auth Router`, `Documentos: Modelos & CRUD`, `DB Session, Deps & Webhook`, `Base ORM & Permissions`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `ingest()` connect `App Entrypoint (main/health)` to `Documentos: Modelos & CRUD`, `Config, Cerbos Client & Alembic`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `login()` connect `Autenticacao JWT & Auth Router` to `App Entrypoint (main/health)`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `User` (e.g. with `Base` and `TimestampMixin`) actually correct?**
  _`User` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `Document` (e.g. with `Base` and `TimestampMixin`) actually correct?**
  _`Document` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `ingest()` (e.g. with `pdf_to_text()` and `split_text()`) actually correct?**
  _`ingest()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Cliente fino sobre a API REST do Cerbos (POST /api/check/resources).      ponyta`, `1 CheckResources p/ N recursos. resources: [{'id':..., 'attr':{...}}, ...].`, `Embeddings selecionadas por env. Carrega uma vez (modelo local e pesado).` to the rest of the system?**
  _110 weakly-connected nodes found - possible documentation gaps or missing edges._