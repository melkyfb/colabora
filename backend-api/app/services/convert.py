"""Conversao de documentos (PDF/DOCX) para HTML compativel com o schema Tiptap.

DOCX: mammoth (default ja embute imagens como data-URI).
PDF: pymupdf com heuristicas declaradas de melhor-esforco (spec 2026-07-13):
heading por tamanho de fonte vs mediana, bold pela flag do span, listas por
prefixo de marcador. Sem tabelas nem imagens de PDF (v1).
"""
import html as html_mod
import io
import re
import statistics

import fitz  # pymupdf
import mammoth

# flag 16 = bold na fontflag do span do pymupdf
_BOLD_FLAG = 16
_BULLET_RE = re.compile(r"^\s*([•·▪‣\-\*]|\d+[.)])\s+")
_ORDERED_RE = re.compile(r"^\s*\d+[.)]\s+")


def docx_to_html(raw: bytes) -> str:
    # warnings do mammoth ignorados de proposito (best-effort, spec)
    return mammoth.convert_to_html(io.BytesIO(raw)).value


def pdf_to_html(raw: bytes) -> str:
    doc = fitz.open(stream=raw, filetype="pdf")

    # 1a passada: mediana dos tamanhos de fonte do documento inteiro
    sizes: list[float] = []
    pages_blocks: list[list[dict]] = []
    for page in doc:
        blocks = page.get_text("dict")["blocks"]
        pages_blocks.append(blocks)
        for block in blocks:
            for line in block.get("lines", []):
                for span in line["spans"]:
                    if span["text"].strip():
                        sizes.append(span["size"])
    if not sizes:
        return ""
    median = statistics.median(sizes)

    out: list[str] = []
    open_list: str | None = None  # "ul" | "ol"

    def close_list() -> None:
        nonlocal open_list
        if open_list:
            out.append(f"</{open_list}>")
            open_list = None

    for blocks in pages_blocks:
        for block in blocks:
            lines = block.get("lines", [])
            if not lines:
                continue
            parts: list[str] = []
            max_size = 0.0
            for line in lines:
                line_parts: list[str] = []
                for span in line["spans"]:
                    t = span["text"]
                    if not t.strip():
                        continue
                    max_size = max(max_size, span["size"])
                    esc = html_mod.escape(t)
                    if span["flags"] & _BOLD_FLAG:
                        esc = f"<strong>{esc}</strong>"
                    line_parts.append(esc)
                if line_parts:
                    parts.append("".join(line_parts))
            text = " ".join(parts).strip()
            if not text:
                continue

            # texto sem tags pra decidir lista (o escape nao muda os prefixos)
            plain = re.sub(r"</?strong>", "", text)

            if max_size >= median * 1.6:
                close_list()
                out.append(f"<h1>{text}</h1>")
            elif max_size >= median * 1.4:
                close_list()
                out.append(f"<h2>{text}</h2>")
            elif max_size >= median * 1.25:
                close_list()
                out.append(f"<h3>{text}</h3>")
            elif _BULLET_RE.match(plain):
                kind = "ol" if _ORDERED_RE.match(plain) else "ul"
                if open_list != kind:
                    close_list()
                    out.append(f"<{kind}>")
                    open_list = kind
                item = _BULLET_RE.sub("", text, count=1)
                out.append(f"<li><p>{item}</p></li>")
            else:
                close_list()
                out.append(f"<p>{text}</p>")
        close_list()

    return "".join(out)


_TAG_RE = re.compile(r"<[^>]+>")
_BLOCK_END_RE = re.compile(r"</(p|h[1-6]|li|tr|div)>|<br\s*/?>", re.I)


def html_to_text(html_str: str) -> str:
    """Strip de tags pros chunks do RAG e pro fallback de Document.content."""
    with_breaks = _BLOCK_END_RE.sub("\n", html_str)
    text = _TAG_RE.sub("", with_breaks)
    return html_mod.unescape(text).strip()
