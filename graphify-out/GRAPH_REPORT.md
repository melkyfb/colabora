# Graph Report - C:/Users/itsal/colabora  (2026-07-09)

## Corpus Check
- 12 files · ~8,845 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 305 nodes · 376 edges · 45 communities (29 shown, 16 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.74)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Auth JWT, Deps & Base ORM
- Config, Cerbos Client & Alembic Env
- Frontend: Deps (Tiptap/Y.js/React)
- Script bulk_ingest (NyxClient)
- Realtime: Deps (Hocuspocus/axios)
- RAG: Ingest, Search & Chat
- Documentos: Modelo, CRUD & Estado Binario
- Frontend: App, API Client & AiSidebar
- Frontend: tsconfig
- DB Session & Authz Interna (Hocuspocus)
- Compose: Servicos & Healthchecks
- Realtime: tsconfig
- Docs: README backend
- Webhooks Hocuspocus (texto + binario)
- Cerbos: Papeis & Policy de Documento
- Schemas de Documento
- Realtime: Auth Client
- Docs: README raiz
- Realtime: Server Hocuspocus
- Entrypoint (migrations+uvicorn)
- Docs soltos
- Node isolado 30
- Node isolado 31
- Node isolado 32
- Node isolado 34
- Node isolado 37
- Node isolado 38
- Node isolado 39
- Node isolado 40
- Node isolado 41
- Node isolado 42
- Node isolado 43
- Node isolado 44

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 14 edges
2. `NyxClient` - 10 edges
3. `compilerOptions` - 9 edges
4. `Document` - 9 edges
5. `_authorize()` - 9 edges
6. `backend-api FastAPI (REST gatekeeper + ABAC, python urllib healthcheck)` - 9 edges
7. `backend-api — Motor Principal (Fase 2)` - 8 edges
8. `ingest()` - 8 edges
9. `User` - 7 edges
10. `login()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Document Resource Policy` --implements--> `Document Resource`  [INFERRED]
  infra/cerbos/policies/document.yaml → backend-api/README.md
- `Idea Md` --references--> `Readme Md`  [INFERRED]
  IDEA.md → frontend/README.md
- `ingest()` --calls--> `pdf_to_text()`  [INFERRED]
  backend-api/app/routers/rag.py → backend-api/app/rag/ingest.py
- `rag_chat()` --calls--> `get_llm()`  [INFERRED]
  backend-api/app/routers/rag.py → backend-api/app/rag/llm.py
- `ingest()` --calls--> `add_chunks()`  [INFERRED]
  backend-api/app/routers/rag.py → backend-api/app/rag/vectorstore.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Document Role Hierarchy (l1/lead/admin/owner)** — infra_cerbos_policies_document_engineer_l1_role, infra_cerbos_policies_document_engineer_lead_role, infra_cerbos_policies_document_admin_role, infra_cerbos_policies_derived_roles_owner_role [EXTRACTED 0.85]

## Communities (45 total, 16 thin omitted)

### Community 0 - "Auth JWT, Deps & Base ORM"
Cohesion: 0.09
Nodes (23): get_current_user(), AsyncSession, create_access_token(), decode_token(), hash_password(), verify_password(), Base, TimestampMixin (+15 more)

### Community 1 - "Config, Cerbos Client & Alembic Env"
Cohesion: 0.08
Nodes (16): _do_run_migrations(), run_migrations_online(), CerbosClient, 1 CheckResources p/ N recursos. resources: [{'id':..., 'attr':{...}}, ...]., Cliente fino sobre a API REST do Cerbos (POST /api/check/resources).      ponyta, Settings, get_embeddings(), Embeddings selecionadas por env. Carrega uma vez (modelo local e pesado). (+8 more)

### Community 2 - "Frontend: Deps (Tiptap/Y.js/React)"
Cohesion: 0.07
Nodes (27): dependencies, @hocuspocus/provider, react, react-dom, @tiptap/extension-collaboration, @tiptap/extension-image, @tiptap/extension-link, @tiptap/extension-underline (+19 more)

### Community 3 - "Script bulk_ingest (NyxClient)"
Cohesion: 0.17
Nodes (14): Path, carregar_estado(), coletar_arquivos(), main(), NyxClient, processar_arquivo(), Retorna arquivos suportados da pasta (recursivo)., Carrega arquivos ja processados (pra --resume). (+6 more)

### Community 4 - "Realtime: Deps (Hocuspocus/axios)"
Cohesion: 0.10
Nodes (20): dependencies, axios, @hocuspocus/extension-redis, @hocuspocus/extension-webhook, @hocuspocus/server, @hocuspocus/transformer, yjs, devDependencies (+12 more)

### Community 5 - "RAG: Ingest, Search & Chat"
Cohesion: 0.19
Nodes (16): pdf_to_text(), split_text(), ChatRequest, ChatResponse, ingest(), IngestResponse, AsyncSession, BaseModel (+8 more)

### Community 6 - "Documentos: Modelo, CRUD & Estado Binario"
Cohesion: 0.27
Nodes (16): Document, _authorize(), create_document(), delete_document(), get_document(), get_document_state(), _get_or_404(), AsyncSession (+8 more)

### Community 7 - "Frontend: App, API Client & AiSidebar"
Cohesion: 0.17
Nodes (9): AiSidebar(), ChatReply, ChatSource, createDocument(), ragChat(), App(), Editor(), fileToBase64() (+1 more)

### Community 8 - "Frontend: tsconfig"
Cohesion: 0.12
Nodes (15): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noUnusedLocals (+7 more)

### Community 9 - "DB Session & Authz Interna (Hocuspocus)"
Cohesion: 0.24
Nodes (8): get_db(), AsyncSession, authorize(), AuthorizeRequest, AuthorizeResponse, AsyncSession, BaseModel, Usado pelo onAuthenticate do Hocuspocus: valida JWT + Cerbos antes do WS.

### Community 10 - "Compose: Servicos & Healthchecks"
Cohesion: 0.22
Nodes (11): backend-api FastAPI (REST gatekeeper + ABAC, python urllib healthcheck), Cerbos 0.40 ABAC (distroless binary healthcheck), Embeddings provider config (EMBEDDINGS_PROVIDER, default local), frontend Vite/React Tiptap+Y.js (node fetch healthcheck), hf_cache volume (HuggingFace embeddings model cache), LLM provider config (LLM_PROVIDER claude|openai|ollama|local, ANTHROPIC_API_KEY, OLLAMA_BASE_URL), MySQL 8.4 (document final state + business data, mysqladmin ping healthcheck), OpenSearch 2.15 (RAG vector store, curl cluster-health healthcheck) (+3 more)

### Community 11 - "Realtime: tsconfig"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, outDir, skipLibCheck, strict, target (+2 more)

### Community 12 - "Docs: README backend"
Cohesion: 0.22
Nodes (8): Autorizacao (ABAC via Cerbos), backend-api — Motor Principal (Fase 2), Endpoints, Estrutura, Rodar (dockerizado), Rodar local (sem Docker, contra a infra dockerizada), Testes, Webhook Hocuspocus

### Community 13 - "Webhooks Hocuspocus (texto + binario)"
Cohesion: 0.48
Nodes (6): hocuspocus_state(), hocuspocus_webhook(), AsyncSession, Recebe o estado binario Y.js (onStoreDocument do Hocuspocus) e grava no MySQL., _verify_signature(), Request

### Community 14 - "Cerbos: Papeis & Policy de Documento"
Cohesion: 0.48
Nodes (7): Document Resource, common_roles Derived Roles, owner derived role (ABAC ownerId condition), admin role (all actions), engineer_l1 role (read/view), engineer_lead role (read+write), Document Resource Policy

### Community 15 - "Schemas de Documento"
Cohesion: 0.60
Nodes (4): DocumentCreate, DocumentOut, DocumentUpdate, BaseModel

### Community 17 - "Docs: README raiz"
Cohesion: 0.50
Nodes (3): Estrutura, Fase 1 — subir a infra local, Nyx Platform — Data Management Platform (PoC)

## Knowledge Gaps
- **97 isolated node(s):** `Estrutura`, `Fase 1 — subir a infra local`, `Rodar (dockerizado)`, `Rodar local (sem Docker, contra a infra dockerizada)`, `Estrutura` (+92 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ingest()` connect `RAG: Ingest, Search & Chat` to `Config, Cerbos Client & Alembic Env`, `Documentos: Modelo, CRUD & Estado Binario`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `Self-check das rotinas de auth. Roda sem DB/infra: pytest -q.`, `Estrutura`, `Fase 1 — subir a infra local` to the rest of the system?**
  _115 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth JWT, Deps & Base ORM` be split into smaller, more focused modules?**
  _Cohesion score 0.09462365591397849 - nodes in this community are weakly interconnected._
- **Should `Config, Cerbos Client & Alembic Env` be split into smaller, more focused modules?**
  _Cohesion score 0.082010582010582 - nodes in this community are weakly interconnected._
- **Should `Frontend: Deps (Tiptap/Y.js/React)` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `Realtime: Deps (Hocuspocus/axios)` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `Frontend: tsconfig` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._