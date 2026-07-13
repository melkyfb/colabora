# Design — Conversão de Documentos (PDF/DOCX → editável) (2026-07-13)

Aprovado pelo usuário em 2026-07-13. Terceiro sub-projeto do pedido original
"full text editor tipo gdocs/ms word" (os dois primeiros — upgrade da toolbar
e comentários/track-changes — já estão implementados e na main).

## Objetivo

Importar arquivos PDF e DOCX para dentro do sistema como conteúdo **editável**
no editor Tiptap, preservando formatação quando o formato de origem permite,
com indexação automática no RAG.

## Decisões de escopo (respostas do usuário)

- **Fidelidade PDF:** heurísticas (opção B) — headings por tamanho de fonte,
  listas por marcadores, negrito por flags de fonte. Melhor-esforço declarado.
- **Fluxos de import:** os dois (opção C) — botão no header cria doc novo;
  botão na toolbar insere no doc aberto, na posição do cursor.
- **Formatos:** PDF + DOCX apenas (opção A). ODT/RTF/.doc legado ficam fora.
- **RAG:** auto-indexar no import (opção A) — mesma chamada de conversão.
- **Arquivo original:** descartado após conversão (opção A) — sem storage novo.

## Arquitetura (abordagem A aprovada)

Backend converte arquivo → **HTML**; frontend injeta o HTML no editor Tiptap
conectado. O parser HTML do Tiptap (schema já registrado: headings, negrito/
itálico/sublinhado/tachado, listas, tabelas, imagens base64, links, blockquote,
code block) faz HTML → ProseMirror de graça, e o Y.js/Hocuspocus sincroniza e
persiste sozinho (onStoreDocument). **Zero mudança no realtime-server.**

Alternativas descartadas: backend gerar Tiptap JSON + seed no Hocuspocus
(exigiria parser HTML→JSON próprio em Python e mudança no onLoadDocument);
conversão no browser (heurísticas de PDF pesadas no cliente, RAG viraria
segunda chamada de qualquer forma).

## Backend

Novas dependências (pyproject.toml): `mammoth` (DOCX→HTML) e `pymupdf` (PDF).

Novo módulo `backend-api/app/services/convert.py`:

- `docx_to_html(raw: bytes) -> str` — mammoth, com imagens embutidas como
  data-URI (casa com o editor, que já usa imagens base64). Warnings do
  mammoth são ignorados (best-effort).
- `pdf_to_html(raw: bytes) -> str` — pymupdf por blocos/spans:
  - heading: tamanho de fonte ≥ ~1.3× a mediana do documento → h1/h2/h3 por
    faixas de tamanho;
  - negrito: flag bold do span → `<strong>`;
  - listas: linhas iniciando com `•`, `-`, `*` ou padrão `1.` → `<ul>`/`<ol>`;
  - resto: parágrafos por bloco de texto.
  - **Sem tabelas de PDF** (heurística não confiável) e **sem imagens de PDF** (v1).
- `html_to_text(html: str) -> str` — strip de tags, para os chunks do RAG e
  para o fallback de `content`.

Endpoint único, em router novo `backend-api/app/routers/imports.py`
(registrado no main.py):

`POST /api/documents/{doc_id}/convert` — multipart file. Autorização: `edit`
via `_authorize` existente (import de `app.routers.documents`, mesmo padrão
do router de comentários).

Fluxo do endpoint:
1. Valida formato por extensão + content-type → **415** se não PDF/DOCX.
2. Valida tamanho ≤ **20MB** → **413**.
3. Converte → HTML; extrai texto.
4. Sem texto extraível (PDF escaneado, DOCX vazio) → **400**.
5. Chunks do texto → `add_chunks` no OpenSearch em `asyncio.to_thread`
   (mesmo padrão do `/api/rag/documents/{id}/ingest` existente), metadados
   `document_id`/`owner_id`/`chunk_index` idênticos.
6. Salva `doc.content` = texto plano — fallback: se o cliente morrer antes de
   injetar o HTML, o seeder existente do Hocuspocus (onLoadDocument) ainda
   entrega o texto como parágrafos editáveis. O webhook onChange sobrescreve
   depois com o conteúdo real do editor.
7. Retorna `{ "html": str, "chunks": int }`.

## Frontend

`api.ts`: `convertDocument(token, docId, file): Promise<{ html: string }>` —
multipart via `authedFetch` (ganha refresh-and-retry e logout-on-401 de graça).

**Fluxo 1 — header "Importar doc"** (App.tsx, ao lado de "Novo doc"):
1. File input oculto (`accept=".pdf,.docx"`).
2. Cria doc via `createDocument` com título = nome do arquivo sem extensão.
3. Chama `convertDocument` → guarda `{ docId, html }` em estado
   `pendingImport` no App. **Se a conversão falhar** (415/413/400), apaga o
   doc recém-criado (`DELETE /api/documents/{id}` — o criador é owner, tem
   permissão) e mostra o erro; sem docs órfãos.
4. Abre o doc. O Editor espera o evento **`synced`** do HocuspocusProvider
   (para não colidir com o seed do onLoadDocument) e então
   `editor.commands.setContent(html)` (substitui o conteúdo semeado) e limpa
   `pendingImport` via callback.
5. Persistência via Y.js normal.

**Fluxo 2 — toolbar "📥 Importar"** (doc aberto):
File input → `convertDocument(docId atual)` →
`editor.chain().focus().insertContent(html).run()` na posição do cursor.
Sem estado no App.

Gating: o botão da **toolbar** é desabilitado sem `can_edit` (o endpoint
exige edit no doc alvo de qualquer forma — defesa em profundidade). O botão
do **header** fica disponível pra qualquer usuário autenticado: o doc novo é
criado por ele mesmo, e o criador é owner (derived role do Cerbos) — o check
de edit passa. Erros mostram o `detail` retornado pelo backend, sem `alert()`.

## Erros

- **415** — formato não suportado (só .pdf/.docx).
- **413** — arquivo > 20MB.
- **400** — sem texto extraível.
- Conversão DOCX best-effort: warnings do mammoth ignorados.

## Limites conhecidos (aceitos)

- PDF: heurística é melhor-esforço — headings/listas podem sair errados em
  layouts complexos (multi-coluna, decorativos). Sem tabelas nem imagens de PDF.
- DOCX: o que o schema Tiptap não tem (font family, margens, colunas, headers/
  footers) é descartado na inserção — comportamento correto do parser.
- PDF escaneado (só imagem) → 400. Sem OCR.

## Fora de escopo

ODT/RTF/.doc legado · OCR · guardar o arquivo original · exportar de volta
para DOCX/PDF (o "Salvar HTML" e o print já existem) · conversão em lote.

## Testes

- curl com DOCX real (headings, negrito, lista, tabela, imagem) → HTML
  retornado contém as tags esperadas; chunks > 0 no retorno; busca no
  OpenSearch encontra o conteúdo.
- curl com PDF real → parágrafos + headings heurísticos no HTML.
- curl casos de erro: .txt → 415; arquivo grande → 413; PDF só-imagem → 400.
- `tsc --noEmit` no frontend.
- E2E manual no browser: importar DOCX pelo header → doc novo abre com
  formatação visível no editor; importar via toolbar no meio de doc existente
  → conteúdo entra no cursor; perguntar ao Assistente IA sobre o conteúdo
  importado → RAG encontra; viewer (engineer_l1) vê o botão da toolbar
  desabilitado num doc alheio (o do header continua disponível — doc próprio).
