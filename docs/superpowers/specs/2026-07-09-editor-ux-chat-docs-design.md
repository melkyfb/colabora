# Design — Editor UX + ChatIA de documentos (2026-07-09)

Aprovado pelo usuário em 2026-07-09. Cinco features sobre a stack existente
(FastAPI + Hocuspocus + React/Tiptap). Nenhuma mudança de arquitetura; regras
duras do Dual-Stack inalteradas (WS direto no Hocuspocus, FastAPI nunca proxya WS).

## F1 — Toolbar de formatação como componente

Decisão (usuário): avaliada a opção "plugin pronto" — Tiptap UI Components (oficial)
é scaffold shadcn-style (dezenas de arquivos vendorizados + SCSS próprio) e
reactjs-tiptap-editor embrulha o editor (conflita com Collaboration/Hocuspocus).
Viáveis, não melhores. **Escolhido: extrair componente próprio.**

- `frontend/src/Toolbar.tsx` (novo): `<Toolbar editor={editor} docId={docId} />`
  com B / I / U · alinhamento esq/centro/dir/justificado · listas (bullet/ordenada)
  · link · imagem (upload→base64) · 💾 salvar HTML · 🖨️ imprimir.
- Alinhamento via `@tiptap/extension-text-align` (types: heading, paragraph).
- `Editor.tsx` volta a ser só editor+provider e renderiza `<Toolbar/>`.
- Comentário `ponytail:` documenta upgrade path (Tiptap UI Components) se crescer.

## F2 — Imprimir / Salvar como PDF

`window.print()` (botão já existe) + CSS `@media print`: esconde header, toolbar,
sidebar e status; `.prose` vira página branca com texto preto, sem padding de app.
"Salvar como PDF" = destino nativo do diálogo de impressão do browser. Zero deps.

## F3 — Cadastro em modal

`Login.tsx`: card de login fica só email+senha+Entrar. Botão "Criar conta" abre
`<dialog>` **nativo** (sem lib) com email, senha, confirmar senha e select de role
(engineer_l1/engineer_lead/admin — PoC). Sucesso → auto-login → fecha modal.
Validação: senhas iguais antes de enviar.

## F4 — Nome do documento (exibir/editar)

Backend já tem `title` + `GET/PUT /api/documents/{id}` (Cerbos view/edit).
- `api.ts`: `getDocument(token,id)` e `updateDocument(token,id,{title})`.
- `Editor.tsx`: barra de título — busca título ao abrir; clique edita inline
  (Enter/blur salva via PUT). 403 → mantém somente leitura do título.
- `App.tsx`: "Novo doc" pergunta o nome (`prompt`), default "Documento sem titulo".
- Escopo (usuário): **sem** endpoint de listagem; abrir por id permanece.

## F5 — ChatIA encontra documentos + botão Abrir

Decisão (usuário): **sem tool-calling** — busca semântica roda sempre.
- Backend `rag.py`: após filtro Cerbos (`allowed_resource_ids`), join no MySQL
  (`Document.id/title/updated_at`) → `SearchHit` ganha `title`; `ChatResponse`
  ganha `documents[]` dedupado `{id, title, updatedAt}`. Contexto do LLM passa a
  citar títulos; system prompt orienta a apontar títulos quando pedirem pra
  encontrar/abrir documento.
- `AiSidebar.tsx`: nova prop `onOpenDoc(id)`; renderiza "📄 Documentos
  encontrados" com botão **Abrir** por doc.
- `App.tsx`: passa `onOpenDoc` → seta `docId` (abre no editor).
- Funciona com qualquer `LLM_PROVIDER` (claude/openai/ollama/local).

## Fora de escopo

Tool-calling no chat; listagem/gerência de documentos; filtro por data na busca;
Tiptap UI Components. Todos ficam como evolução natural.

## Validação

`tsc --noEmit` (frontend), `pytest` (backend), stack `docker compose up` com
healthchecks nativos por linguagem; E2E manual: login→novo doc→editar→chat→Abrir.
