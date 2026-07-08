#!/bin/bash
set -e
echo "[entrypoint] Rodando migrations…"
alembic upgrade head
echo "[entrypoint] Iniciando uvicorn…"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000