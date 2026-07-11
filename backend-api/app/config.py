from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # em Docker as vars vem do compose (environment/env_file); defaults servem p/ rodar
    # alembic/uvicorn local contra a infra dockerizada (localhost).
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "mysql+aiomysql://nyx:nyx_dev_pw@localhost:3306/nyx"
    JWT_SECRET: str = "dev-only-secret-change-me-min-32-bytes-long"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CERBOS_HTTP_URL: str = "http://localhost:3592"
    HOCUSPOCUS_WEBHOOK_SECRET: str = "dev-webhook-secret-change-me"
    # chave compartilhada Hocuspocus <-> FastAPI p/ o endpoint interno de authz.
    INTERNAL_API_KEY: str = "dev-internal-key-change-me-min-32-bytes"

    # ── RAG (Fase 4) ──
    OPENSEARCH_URL: str = "http://localhost:9200"
    RAG_INDEX: str = "nyx-documents"
    EMBEDDINGS_PROVIDER: str = "local"  # local | openai | fake
    EMBEDDINGS_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIM: int = 384  # usado so pelo provider 'fake'
    OPENAI_API_KEY: str | None = None

    # ── LLM chat (Fase 5) ── claude | openai | ollama | local
    LLM_PROVIDER: str = "claude"
    LLM_MODEL: str = ""  # vazio = default do provider (claude -> claude-opus-4-8)
    ANTHROPIC_API_KEY: str | None = None
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OPENAI_API_BASE_URL: str = "https://api.openai.com/v1"

    # ── CORS (Fase 5) ── origens do frontend, separadas por virgula
    CORS_ORIGINS: str = "http://localhost:5173"


settings = Settings()
