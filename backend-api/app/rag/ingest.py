import io

from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader

_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)


def pdf_to_text(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def split_text(text: str) -> list[str]:
    return _splitter.split_text(text)
