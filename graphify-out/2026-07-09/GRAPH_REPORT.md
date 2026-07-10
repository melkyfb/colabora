# Graph Report - .  (2026-07-09)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 282 nodes · 356 edges · 42 communities (27 shown, 15 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f3131a5c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- dependencies
- User
- login
- config.py
- NyxClient
- rag.py
- package.json
- api.ts
- db.py
- compilerOptions
- compilerOptions
- backend-api — Motor Principal (Fase 2)
- CerbosClient
- Document Resource Policy
- auth.ts
- Nyx Platform — Data Management Platform (PoC)
- entrypoint.sh
- Readme Md
- Cerbos httpx Client (/api/check/resources)
- FastAPI backend-api (REST Gatekeeper)
- JWT + bcrypt Auth
- Docker Compose Yml
- Index Html
- Improvements Md
- Cerbos Server Config (disk storage, hot-reload)
- nyx-backend-api
- Dual-Stack Architecture
- Hard Rule: FastAPI Never Proxies WebSocket
- Nyx Platform (PoC)
- Processing/AI Lane
- Real-Time Lane (CRDT)

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 14 edges
2. `User` - 13 edges
3. `NyxClient` - 10 edges
4. `compilerOptions` - 9 edges
5. `Document` - 8 edges
6. `_authorize()` - 8 edges
7. `backend-api — Motor Principal (Fase 2)` - 8 edges
8. `ingest()` - 8 edges
9. `login()` - 7 edges
10. `_retrieve_allowed()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Document Resource Policy` --implements--> `Document Resource`  [INFERRED]
  infra/cerbos/policies/document.yaml → backend-api/README.md
- `Idea Md` --references--> `Readme Md`  [INFERRED]
  IDEA.md → frontend/README.md
- `hocuspocus_webhook()` --indirect_call--> `Document`  [INFERRED]
  backend-api/app/routers/webhooks.py → backend-api/app/models/document.py
- `login()` --indirect_call--> `User`  [INFERRED]
  backend-api/app/routers/auth.py → backend-api/app/models/user.py
- `me()` --references--> `User`  [EXTRACTED]
  backend-api/app/routers/auth.py → backend-api/app/models/user.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Document Role Hierarchy (l1/lead/admin/owner)** — infra_cerbos_policies_document_engineer_l1_role, infra_cerbos_policies_document_engineer_lead_role, infra_cerbos_policies_document_admin_role, infra_cerbos_policies_derived_roles_owner_role [EXTRACTED 0.85]

## Communities (42 total, 15 thin omitted)

### Community 0 - "dependencies"
Cohesion: 0.07
Nodes (27): dependencies, @hocuspocus/provider, react, react-dom, @tiptap/extension-collaboration, @tiptap/extension-image, @tiptap/extension-link, @tiptap/extension-underline (+19 more)

### Community 1 - "User"
Cohesion: 0.18
Nodes (18): Base, TimestampMixin, Document, Permission, User, _authorize(), create_document(), delete_document() (+10 more)

### Community 2 - "login"
Cohesion: 0.12
Nodes (18): get_current_user(), AsyncSession, create_access_token(), decode_token(), hash_password(), verify_password(), login(), me() (+10 more)

### Community 3 - "config.py"
Cohesion: 0.11
Nodes (13): _do_run_migrations(), run_migrations_online(), Settings, get_embeddings(), Embeddings selecionadas por env. Carrega uma vez (modelo local e pesado)., get_llm(), Chat LLM selecionado por env. Carrega uma vez.      Providers: claude (default), add_chunks() (+5 more)

### Community 4 - "NyxClient"
Cohesion: 0.17
Nodes (14): Path, carregar_estado(), coletar_arquivos(), main(), NyxClient, processar_arquivo(), Retorna arquivos suportados da pasta (recursivo)., Carrega arquivos ja processados (pra --resume). (+6 more)

### Community 5 - "rag.py"
Cohesion: 0.19
Nodes (17): pdf_to_text(), split_text(), ChatRequest, ChatResponse, ingest(), IngestResponse, AsyncSession, BaseModel (+9 more)

### Community 6 - "package.json"
Cohesion: 0.10
Nodes (19): dependencies, @hocuspocus/extension-redis, @hocuspocus/extension-webhook, @hocuspocus/server, @hocuspocus/transformer, yjs, devDependencies, tsx (+11 more)

### Community 7 - "api.ts"
Cohesion: 0.20
Nodes (11): AiSidebar(), ChatReply, ChatSource, createDocument(), login(), ragChat(), register(), App() (+3 more)

### Community 8 - "db.py"
Cohesion: 0.16
Nodes (12): get_db(), AsyncSession, authorize(), AuthorizeRequest, AuthorizeResponse, AsyncSession, BaseModel, Usado pelo onAuthenticate do Hocuspocus: valida JWT + Cerbos antes do WS. (+4 more)

### Community 9 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noUnusedLocals (+7 more)

### Community 10 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, outDir, skipLibCheck, strict, target (+2 more)

### Community 11 - "backend-api — Motor Principal (Fase 2)"
Cohesion: 0.22
Nodes (8): Autorizacao (ABAC via Cerbos), backend-api — Motor Principal (Fase 2), Endpoints, Estrutura, Rodar (dockerizado), Rodar local (sem Docker, contra a infra dockerizada), Testes, Webhook Hocuspocus

### Community 12 - "CerbosClient"
Cohesion: 0.29
Nodes (3): CerbosClient, 1 CheckResources p/ N recursos. resources: [{'id':..., 'attr':{...}}, ...]., Cliente fino sobre a API REST do Cerbos (POST /api/check/resources).      ponyta

### Community 13 - "Document Resource Policy"
Cohesion: 0.48
Nodes (7): Document Resource, common_roles Derived Roles, owner derived role (ABAC ownerId condition), admin role (all actions), engineer_l1 role (read/view), engineer_lead role (read+write), Document Resource Policy

### Community 14 - "auth.ts"
Cohesion: 0.48
Nodes (4): authorizeConnection(), AuthzResult, config, server

### Community 15 - "Nyx Platform — Data Management Platform (PoC)"
Cohesion: 0.50
Nodes (3): Estrutura, Fase 1 — subir a infra local, Nyx Platform — Data Management Platform (PoC)

## Knowledge Gaps
- **91 isolated node(s):** `Estrutura`, `Fase 1 — subir a infra local`, `Rodar (dockerizado)`, `Rodar local (sem Docker, contra a infra dockerizada)`, `Estrutura` (+86 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `User` connect `User` to `login`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `ingest()` connect `rag.py` to `config.py`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `login()` connect `login` to `User`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `User` (e.g. with `Base` and `TimestampMixin`) actually correct?**
  _`User` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Self-check das rotinas de auth. Roda sem DB/infra: pytest -q.`, `Estrutura`, `Fase 1 — subir a infra local` to the rest of the system?**
  _107 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `login` be split into smaller, more focused modules?**
  _Cohesion score 0.1225296442687747 - nodes in this community are weakly interconnected._