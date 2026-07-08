"""Self-check do splitter. Skip se langchain-text-splitters nao instalado."""

import pytest

pytest.importorskip("langchain_text_splitters")

from app.rag.ingest import split_text  # noqa: E402


def test_split_text_produces_multiple_chunks():
    text = "Frase de engenharia aeroespacial. " * 500
    chunks = split_text(text)
    assert len(chunks) > 1
    assert all(c.strip() for c in chunks)
