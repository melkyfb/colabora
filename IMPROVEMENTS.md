# Improvements — Nyx Platform

Lista de melhorias identificadas, não priorizadas. Abre PR quando implementar.

---

## RAG Pipeline

### Indexação frágil e sem controle de estado

**Problema:** O endpoint `POST /api/rag/documents/{id}/ingest` não tem idempotência, tracking, nem suporte a deleção. Indexar o mesmo documento 2x duplica chunks no OpenSearch. Não há como remover chunks de um doc específico sem apagar o índice inteiro.

**Sugestões:**

1. **Tabela `ingestion_log` no MySQL** — registra `document_id`, `status` (pending/indexing/done/error), `chunks`, `created_at`. Permite saber o que já foi indexado e reindexar com segurança.

2. **Endpoint `DELETE /api/rag/documents/{id}/chunks`** — remove chunks de um doc pelo `document_id` no metadado antes de reindexar, eliminando duplicação.

3. **Upload unificado** — criar `POST /api/rag/ingest` (sem doc prévio) que cria o Document + indexa os chunks num passo só, útil para arquivos avulsos.

4. **Background async** — substituir o processamento síncrono por `BackgroundTasks` do FastAPI ou Celery para arquivos grandes (>5 MB).

5. **Suporte a mais formatos** — adicionar `.docx` (python-docx), `.csv` (cabeçalho + linhas), `.ipynb` (células de markdown).

6. **Chunk tracking por hash** — hash do chunk (SHA256) no metadado do OpenSearch; na indexação, upsert em vez de append, garantindo idempotência real.

---

## Infra / Docker

### OpenSearch com segurança desligada

`DISABLE_SECURITY_PLUGIN=true` em dev. Em produção precisa de TLS + auth + rede isolada.

### Credenciais hardcoded nos defaults

`config.py` e `.env.example` tem senhas de dev (`dev-only-secret-change-me`). Ok pra dev mas precisa de vault (ex.: AWS Secrets Manager / HashiCorp Vault) em staging+.

---

## Backend API

### CORS overly permissive

`allow_origins` lê de `CORS_ORIGINS` (vírgula) mas o default é só `http://localhost:5173`. Em produção precisa de white-list restrita.

### Sem rate limiting

Nenhum endpoint tem throttling. `POST /api/auth/login` e `/api/rag/chat` são vetores óbvios de brute force / abuso.

---

## Frontend

### Sem feedback visual de upload

`AiSidebar.tsx` só tem chat. Upload de PDF para indexar exige curl. Adicionar botão de upload com progresso melhoraria DX e testes.

### Sem tratamento de erro no WebSocket

`Editor.tsx` mostra status "NAO AUTORIZADO" mas não tenta reconectar nem fallback. Perde edição se o WS cair.

---

## Testes

### Cobertura baixa no RAG

Só `test_rag.py` testa o splitter. Faltam testes de:
- `POST /api/rag/chat` com mock do LLM + OpenSearch
- `POST /api/rag/documents/{id}/ingest`
- Filtro Cerbos nos resultados da busca
- Webhook HMAC
