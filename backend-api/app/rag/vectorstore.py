from functools import lru_cache

from langchain_community.vectorstores import OpenSearchVectorSearch

from app.config import settings
from app.rag.embeddings import get_embeddings


@lru_cache(maxsize=1)
def get_vectorstore() -> OpenSearchVectorSearch:
    # OpenSearch em dev roda com seguranca desligada -> http, sem TLS/auth.
    return OpenSearchVectorSearch(
        opensearch_url=settings.OPENSEARCH_URL,
        index_name=settings.RAG_INDEX,
        embedding_function=get_embeddings(),
        use_ssl=False,
        verify_certs=False,
    )


def add_chunks(texts: list[str], metadatas: list[dict]) -> list[str]:
    # engine=lucene: nmslib esta deprecado; lucene vem sempre no OpenSearch.
    # Cria o indice com mapping knn no primeiro add.
    return get_vectorstore().add_texts(texts=texts, metadatas=metadatas, engine="lucene")


def search(query: str, k: int):
    """Retorna [(Document, score)] por similaridade K-NN."""
    return get_vectorstore().similarity_search_with_score(query, k=k)
