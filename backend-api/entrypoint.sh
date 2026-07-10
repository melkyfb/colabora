#!/bin/bash
set -e
echo "[entrypoint] Rodando migrations…"
alembic upgrade head
echo "[entrypoint] Iniciando app…"
# respeita o command do compose (uvicorn --reload); fallback se nenhum for passado
if [ "$#" -eq 0 ]; then
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000
else
  exec "$@"
fi
