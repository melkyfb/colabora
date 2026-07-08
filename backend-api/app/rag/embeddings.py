from functools import lru_cache

from app.config import settings


@lru_cache(maxsize=1)
def get_embeddings():
    """Embeddings selecionadas por env. Carrega uma vez (modelo local e pesado)."""
    provider = settings.EMBEDDINGS_PROVIDER
    if provider == "openai":
        from langchain_openai import OpenAIEmbeddings

        return OpenAIEmbeddings(model=settings.EMBEDDINGS_MODEL, api_key=settings.OPENAI_API_KEY)
    if provider == "fake":
        from langchain_community.embeddings import FakeEmbeddings

        return FakeEmbeddings(size=settings.EMBEDDING_DIM)
    # default: local sentence-transformers (sem API key)
    from langchain_huggingface import HuggingFaceEmbeddings

    return HuggingFaceEmbeddings(model_name=settings.EMBEDDINGS_MODEL)
