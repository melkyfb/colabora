from functools import lru_cache

from app.config import settings


@lru_cache(maxsize=1)
def get_llm():
    """Chat LLM selecionado por env. Carrega uma vez.

    Providers: claude (default) | openai | ollama | local.
    Cada import e lazy — so instala/carrega o provider realmente usado.
    """
    provider = settings.LLM_PROVIDER
    model = settings.LLM_MODEL or None

    if provider == "claude":
        # langchain-anthropic usa o SDK oficial `anthropic` por baixo.
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(
            model=model or "claude-opus-4-8",
            api_key=settings.ANTHROPIC_API_KEY,
            max_tokens=1024,
        )
    if provider == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(model=model or "gpt-4o-mini", api_key=settings.OPENAI_API_KEY)
    if provider == "ollama":
        from langchain_ollama import ChatOllama

        return ChatOllama(model=model or "llama3.1", base_url=settings.OLLAMA_BASE_URL)
    if provider == "local":
        # ponytail: modelo generativo local via HF pipeline. Pesado (transformers+torch,
        # ja instalados p/ embeddings). Modelo pequeno por default.
        from langchain_huggingface import HuggingFacePipeline

        return HuggingFacePipeline.from_model_id(
            model_id=model or "Qwen/Qwen2.5-0.5B-Instruct",
            task="text-generation",
            pipeline_kwargs={"max_new_tokens": 512},
        )

    raise ValueError(f"LLM_PROVIDER desconhecido: {provider!r}")
