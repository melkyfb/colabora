# Graph Report - C:/Users/itsal/colabora  (2026-07-08)

## Corpus Check
- Corpus is ~3,009 words - fits in a single context window. You may not need a graph.

## Summary
- 108 nodes · 158 edges · 18 communities (17 shown, 1 thin omitted)
- Extraction: 82% EXTRACTED · 18% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.74)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Autenticacao JWT & Auth Router
- Arquitetura Dual-Stack (Dominio)
- Documentos: Modelos & CRUD
- Config, Cerbos Client & Alembic
- DB Session, Deps & Webhook
- Autorizacao ABAC & Papeis (Cerbos)
- Base ORM & Permissions
- Schemas de Documento
- Pacote nyx-backend-api

## God Nodes (most connected - your core abstractions)
1. `User` - 13 edges
2. `Document` - 8 edges
3. `_authorize()` - 8 edges
4. `Document Resource Policy` - 8 edges
5. `login()` - 7 edges
6. `FastAPI backend-api (REST Gatekeeper)` - 7 edges
7. `_get_or_404()` - 6 edges
8. `update_document()` - 6 edges
9. `Hocuspocus realtime-server` - 6 edges
10. `Base` - 5 edges

## Surprising Connections (you probably didn't know these)
- `onAuthenticate Hook` --calls--> `FastAPI backend-api (REST Gatekeeper)`  [INFERRED]
  realtime-server/README.md → backend-api/README.md
- `Document Resource Policy` --implements--> `Document Resource`  [INFERRED]
  infra/cerbos/policies/document.yaml → backend-api/README.md
- `Y.js CRDT` --implements--> `Real-Time Lane (CRDT)`  [INFERRED]
  frontend/README.md → README.md
- `Hocuspocus realtime-server` --implements--> `Real-Time Lane (CRDT)`  [INFERRED]
  realtime-server/README.md → README.md
- `FastAPI backend-api (REST Gatekeeper)` --implements--> `Processing/AI Lane`  [INFERRED]
  backend-api/README.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Dual-Stack End-to-End Flow: Frontend to Realtime to Backend** — frontend_readme_react_frontend, realtime_server_readme_hocuspocus, backend_api_readme_fastapi_gatekeeper, backend_api_readme_webhook_hocuspocus, docker_compose_mysql [EXTRACTED 0.85]
- **Cerbos Document ABAC Authorization** — backend_api_readme_cerbos_client, infra_cerbos_policies_document_policy, infra_cerbos_policies_derived_roles_owner_role, docker_compose_cerbos [EXTRACTED 0.85]
- **Document Role Hierarchy (l1/lead/admin/owner)** — infra_cerbos_policies_document_engineer_l1_role, infra_cerbos_policies_document_engineer_lead_role, infra_cerbos_policies_document_admin_role, infra_cerbos_policies_derived_roles_owner_role [EXTRACTED 0.85]

## Communities (18 total, 1 thin omitted)

### Community 0 - "Autenticacao JWT & Auth Router"
Cohesion: 0.15
Nodes (16): create_access_token(), decode_token(), hash_password(), verify_password(), login(), me(), AsyncSession, register() (+8 more)

### Community 1 - "Arquitetura Dual-Stack (Dominio)"
Cohesion: 0.16
Nodes (19): Document Resource, FastAPI backend-api (REST Gatekeeper), JWT + bcrypt Auth, /api/webhooks/hocuspocus Webhook, MySQL (Final Document State), OpenSearch (Vector DB / RAG), Redis (Hocuspocus Pub/Sub), React + Tiptap + Y.js Frontend (+11 more)

### Community 2 - "Documentos: Modelos & CRUD"
Cohesion: 0.42
Nodes (10): Document, User, _authorize(), create_document(), delete_document(), get_document(), _get_or_404(), AsyncSession (+2 more)

### Community 3 - "Config, Cerbos Client & Alembic"
Cohesion: 0.18
Nodes (6): _do_run_migrations(), run_migrations_online(), CerbosClient, Cliente fino sobre a API REST do Cerbos (POST /api/check/resources).      ponyta, Settings, BaseSettings

### Community 4 - "DB Session, Deps & Webhook"
Cohesion: 0.20
Nodes (8): get_current_user(), AsyncSession, get_db(), AsyncSession, hocuspocus_webhook(), AsyncSession, _verify_signature(), Request

### Community 5 - "Autorizacao ABAC & Papeis (Cerbos)"
Cohesion: 0.36
Nodes (9): Cerbos httpx Client (/api/check/resources), Cerbos ABAC Authorization, Cerbos Server Config (disk storage, hot-reload), common_roles Derived Roles, owner derived role (ABAC ownerId condition), admin role (all actions), engineer_l1 role (read/view), engineer_lead role (read+write) (+1 more)

### Community 6 - "Base ORM & Permissions"
Cohesion: 0.40
Nodes (4): Base, TimestampMixin, Permission, DeclarativeBase

### Community 7 - "Schemas de Documento"
Cohesion: 0.60
Nodes (4): DocumentCreate, DocumentOut, DocumentUpdate, BaseModel

## Knowledge Gaps
- **5 isolated node(s):** `nyx-backend-api`, `Nyx Platform (PoC)`, `JWT + bcrypt Auth`, `Redis (Hocuspocus Pub/Sub)`, `Cerbos Server Config (disk storage, hot-reload)`
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `User` connect `Documentos: Modelos & CRUD` to `Autenticacao JWT & Auth Router`, `DB Session, Deps & Webhook`, `Base ORM & Permissions`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Why does `login()` connect `Autenticacao JWT & Auth Router` to `Documentos: Modelos & CRUD`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `Document` connect `Documentos: Modelos & CRUD` to `DB Session, Deps & Webhook`, `Base ORM & Permissions`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `User` (e.g. with `Base` and `TimestampMixin`) actually correct?**
  _`User` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `Document` (e.g. with `Base` and `TimestampMixin`) actually correct?**
  _`Document` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `login()` (e.g. with `create_access_token()` and `verify_password()`) actually correct?**
  _`login()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Cliente fino sobre a API REST do Cerbos (POST /api/check/resources).      ponyta`, `nyx-backend-api`, `Self-check das rotinas de auth. Roda sem DB/infra: pytest -q.` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._