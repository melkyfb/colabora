# Nyx Platform — Data Management Platform (PoC)

Arquitetura **Dual-Stack**: separacao estrita entre trafego tempo-real (CRDT) e
trafego pesado de processamento/IA.

```
┌─────────────┐   WebSocket (Y.js)   ┌──────────────────┐   webhook/API    ┌──────────────┐
│  frontend   │ ───────────────────► │  realtime-server │ ───────────────► │  backend-api │
│ React+Tiptap│                      │ Node + Hocuspocus│                  │FastAPI+Python│
└─────────────┘   REST ─────────────────────────────────────────────────► └──────┬───────┘
                                                                                   │
                                          ┌───────────────┬───────────────┬───────┴───────┐
                                       MySQL           Redis          OpenSearch        Cerbos
                                    (persist.)      (Hocuspocus       (vetorial/RAG)    (ABAC)
                                                     scale-out)
```

**Regra dura:** FastAPI NUNCA faz proxy de WebSocket. Real-time vai direto ao Hocuspocus.

## Estrutura

```
infra/            # config de infra (Cerbos policies/config)
backend-api/      # FastAPI (Fase 2+)
realtime-server/  # Hocuspocus (Fase 3+)
frontend/         # React/Vite/Tiptap (Fase 4+)
docker-compose.yml
```

## Fase 1 — subir a infra local

```bash
cp .env.example .env      # .env ja incluso com valores de dev
docker compose up -d
```

Serviços:

| Servico    | Porta        | Uso                                    |
|------------|--------------|----------------------------------------|
| MySQL      | 3306         | Estado final dos docs + dados negocio  |
| Redis      | 6379         | Pub/sub do Hocuspocus (scale-out)      |
| OpenSearch | 9200 / 9600  | Banco vetorial (RAG)                   |
| Cerbos     | 3592 / 3593  | Autorizacao ABAC (HTTP / gRPC)         |

Health check rapido:

```bash
docker compose ps
curl http://localhost:9200/_cluster/health          # OpenSearch (security OFF em dev)
curl http://localhost:3592/_cerbos/health           # Cerbos
```

> OpenSearch roda com `DISABLE_SECURITY_PLUGIN=true` (apenas dev).
