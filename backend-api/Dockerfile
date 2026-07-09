# syntax=docker/dockerfile:1
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# para garantir que o cache seja invalidado apenas se o pyproject.toml mudar
# evitando reinstalar dependências desnecessariamente
COPY pyproject.toml .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    python3 -c "import tomllib, sys; \
        data=tomllib.load(open('pyproject.toml','rb')); \
        deps=data['project']['dependencies']; \
        open('/tmp/requirements.txt','w').write('\\n'.join(deps))" && \
    pip install -r /tmp/requirements.txt

COPY . .

RUN apt update && apt install -y curl

EXPOSE 8000

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
