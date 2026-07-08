#!/usr/bin/env python3
"""
Bulk ingest — dev script para indexar milhares de documentos no RAG.

Uso:
    python scripts/bulk_ingest.py ~/documentos/               # pasta cheia de PDFs/txt
    python scripts/bulk_ingest.py ~/documentos/ --dry-run      # só mostra o que faria
    python scripts/bulk_ingest.py ~/documentos/ --workers 5    # 5 uploads em paralelo
    python scripts/bulk_ingest.py ~/documentos/ --resume       # continua de onde parou
    python scripts/bulk_ingest.py ~/documentos/ --glob "*.pdf" --max 50

Requisitos:
    pip install httpx tqdm   (ou já tem no venv do backend-api)

Autenticação:
    Usa ADMIN_EMAIL / ADMIN_PASSWORD do .env. Faz login uma vez, reusa o token.
    Se CRIA_DOC=false, assume que já existe Document com id = nome do arquivo (sem extensao).
"""

import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urljoin

# ── Opcional: tqdm pra barra de progresso ────────────────────────────────────
try:
    from tqdm import tqdm

    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False


# ── Config ────────────────────────────────────────────────────────────────────
BASE_URL = "http://localhost:8000"
STATE_FILE = Path.home() / ".nyx_bulk_ingest_state.json"

EXTENSOES_SUPORTADAS = {".pdf", ".txt", ".md", ".csv", ".json", ".xml", ".yaml", ".yml", ".html"}


# ── API Client simples ────────────────────────────────────────────────────────
class NyxClient:
    """Wrapper minimalista pra API da Nyx. Sem dependencia externa fora httpx."""

    def __init__(self, base_url: str, email: str = "", password: str = ""):
        self.base_url = base_url.rstrip("/")
        self.token: str | None = None
        self._email = email
        self._password = password

    # ------------------------------------------------------------------
    def _url(self, path: str) -> str:
        return urljoin(self.base_url + "/", path.lstrip("/"))

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    # ------------------------------------------------------------------
    def login(self) -> None:
        """Login com email+password. Levanta erro se falhar."""
        import httpx

        resp = httpx.post(
            self._url("/api/auth/login"),
            data={"username": self._email, "password": self._password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp.raise_for_status()
        self.token = resp.json()["access_token"]
        print(f"[auth] Login OK — token {self.token[:20]}…")

    def create_document(self, title: str) -> int:
        """Cria um Document via REST. Retorna o id."""
        import httpx

        resp = httpx.post(
            self._url("/api/documents"),
            headers=self._headers(),
            json={"title": title},
        )
        if resp.status_code == 409:
            print(f"  [warn] doc '{title}' ja existe? pulando criacao")
            return 0
        resp.raise_for_status()
        return resp.json()["id"]

    def ingest_file(self, doc_id: int, filepath: Path) -> dict:
        """Faz upload do arquivo pra um Document existente."""
        import httpx

        mime = (
            "application/pdf"
            if filepath.suffix.lower() == ".pdf"
            else "text/plain"
        )
        with open(filepath, "rb") as f:
            resp = httpx.post(
    self._url(f"/api/rag/documents/{doc_id}/ingest"),
                headers={"Authorization": f"Bearer {self.token}"},
                files={"file": (filepath.name, f, mime)},
            )
        if resp.status_code == 400:
            # Doc vazio ou sem texto extraivel — nao e erro grave
            detail = resp.json().get("detail", "")
            return {"status": "skipped", "detail": detail, "file": filepath.name}
        resp.raise_for_status()
        return {"status": "ok", **resp.json(), "file": filepath.name}


# ── Logica principal ─────────────────────────────────────────────────────────
def coletar_arquivos(pasta: Path, glob_pattern: str, extensoes: set) -> list[Path]:
    """Retorna arquivos suportados da pasta (recursivo)."""
    arquivos = []
    for f in sorted(pasta.rglob(glob_pattern)):
        if f.is_file() and f.suffix.lower() in extensoes:
            arquivos.append(f)
    return arquivos


def carregar_estado() -> set:
    """Carrega arquivos ja processados (pra --resume)."""
    if STATE_FILE.exists():
        return set(json.loads(STATE_FILE.read_text()))
    return set()


def salvar_estado(processados: set) -> None:
    STATE_FILE.write_text(json.dumps(sorted(processados), indent=2))


def processar_arquivo(client: NyxClient, caminho: Path, criar_doc: bool) -> dict:
    """Processa UM arquivo: cria doc se necessario + ingest."""
    nome_base = caminho.stem  # sem extensao

    # 1. Criar ou reusar Document
    if criar_doc:
        doc_id = client.create_document(nome_base)
        if doc_id == 0:
            # Ja existe — tenta usar nome como id (fallback)
            return {"status": "skipped", "file": caminho.name, "detail": "doc ja existe"}
    else:
        doc_id = nome_base  # CRIA_DOC=false: assume que doc existe com id = nome

    # 2. Upload
    return client.ingest_file(doc_id, caminho)


# ── CLI ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Bulk ingest de documentos no RAG da Nyx")
    parser.add_argument("pasta", type=Path, help="Pasta com os documentos")
    parser.add_argument("--url", default=BASE_URL, help=f"URL base da API (default: {BASE_URL})")
    parser.add_argument("--email", default="", help="Email p/ login (default: email do .env)")
    parser.add_argument("--password", default="", help="Senha p/ login")
    parser.add_argument("--workers", type=int, default=3, help="Uploads paralelos (default: 3)")
    parser.add_argument("--dry-run", action="store_true", help="So lista o que seria processado")
    parser.add_argument("--resume", action="store_true", help="Continua de onde parou")
    parser.add_argument("--glob", default="*", help="Glob pra filtrar (default: '*')")
    parser.add_argument("--ext", nargs="+", default=list(EXTENSOES_SUPORTADAS), help="Extensoes")
    parser.add_argument("--cria-doc", action="store_true", default=True, help="Cria Document no MySQL (default: True)")
    parser.add_argument("--no-cria-doc", action="store_false", dest="cria_doc", help="Pula criacao — doc id = nome do arquivo")
    parser.add_argument("--max", type=int, default=0, help="Maximo de arquivos (0 = todos)")
    parser.add_argument("--delay", type=float, default=0.2, help="Delay entre batches (default: 0.2s)")
    args = parser.parse_args()

    if not args.pasta.exists():
        print(f"[erro] Pasta nao existe: {args.pasta}")
        sys.exit(1)

    # ── Coleta ──
    print(f"[scan] Escaneando {args.pasta}/ com glob={args.glob!r} extensoes={args.ext}…")
    arquivos = coletar_arquivos(args.pasta, args.glob, set(args.ext))
    if args.max > 0:
        arquivos = arquivos[: args.max]

    if not arquivos:
        print("[scan] Nenhum arquivo encontrado.")
        return

    print(f"[scan] Encontrados {len(arquivos)} arquivo(s)")

    # ── Resume ──
    ja_processados = carregar_estado() if args.resume else set()
    if ja_processados:
        antes = len(arquivos)
        arquivos = [f for f in arquivos if f.name not in ja_processados]
        print(f"[resume] Pulando {antes - len(arquivos)} ja processados")

    if not arquivos:
        print("[resume] Todos ja foram processados.")
        return

    # ── Dry-run ──
    if args.dry_run:
        print("\n[dry-run] Arquivos que seriam processados:")
        for f in arquivos:
            print(f"  {f}")
        print(f"  Total: {len(arquivos)}")
        return

    # ── Login ──
    email = args.email or input("Email admin: ")
    password = args.password or "nyx_dev_pw"  # dev default

    client = NyxClient(args.url, email=email, password=password)
    try:
        client.login()
    except Exception as e:
        print(f"[erro] Login falhou: {e}")
        sys.exit(1)

    # ── Processamento ──
    ok = 0
    fail = 0
    skipped = 0
    processados = set(ja_processados)

    if HAS_TQDM:
        from tqdm import tqdm as _tqdm
        iterator = _tqdm(arquivos, desc="Ingest", unit="arquivo")
    else:
        iterator = arquivos

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futuros = {}
        for caminho in iterator:
            futuros[pool.submit(processar_arquivo, client, caminho, args.cria_doc)] = caminho
            time.sleep(args.delay)  # nao sobrecarregar o servidor

        for futuro in as_completed(futuros):
            caminho = futuros[futuro]
            try:
                resultado = futuro.result()
                if resultado["status"] == "ok":
                    ok += 1
                    processados.add(caminho.name)
                elif resultado["status"] == "skipped":
                    skipped += 1
                else:
                    fail += 1
                    if not HAS_TQDM:
                        print(f"  [fail] {caminho.name}: {resultado}")
            except Exception as e:
                fail += 1
                if not HAS_TQDM:
                    print(f"  [erro] {caminho.name}: {e}")

            # Salva estado a cada 10 para nao perder progresso
            if (ok + fail + skipped) % 10 == 0:
                salvar_estado(processados)

    salvar_estado(processados)

    # ── Resumo ──
    print(f"\n{'='*40}")
    print(f"  OK:      {ok}")
    print(f"  Pulados: {skipped}")
    print(f"  Falhas:  {fail}")
    print(f"  Total:   {ok + skipped + fail}/{len(arquivos)}")
    print(f"{'='*40}")
    print(f"  Estado salvo em: {STATE_FILE}")
    if fail > 0:
        print(f"  Reexecute com --resume para tentar os que falharam.")


if __name__ == "__main__":
    main()
