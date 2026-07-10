# Design — Editor rico: upgrade da toolbar (2026-07-10)

Aprovado pelo usuário em 2026-07-10 (via companheiro visual: layout de toolbar e
interação de tabela validados com mockups clicáveis). Primeiro dos dois
sub-projetos do pedido "full text editor tipo gdocs/ms word" — o segundo
(conversão de PDF/DOCX/ODT → editável) fica para um spec seguinte.

## Escopo

100% frontend. Y.js/Hocuspocus já sincroniza qualquer nó ProseMirror (tabela,
task list, heading, etc.) sem mudança de backend — este sub-projeto não toca
`backend-api`, `realtime-server` nem o banco.

## Toolbar — 2 linhas

**Linha 1 (texto + inserção rápida):**
`Normal/H1/H2/H3` (dropdown) · Negrito · Itálico · Sublinhado · Tachado ·
cor de texto · highlight · separador · Desfazer · Refazer.

**Linha 2 (parágrafo + blocos):**
Alinhar (esquerda/centro/direita/justificado) · Lista com marcadores ·
Lista numerada · Lista de tarefas · separador · Blockquote · Code block ·
Linha horizontal · separador · Tabela (grid-picker) · Imagem · Link.

Layout validado via mockup clicável (opção B: texto/formatação de caractere em
cima, parágrafo/inserção embaixo).

## Tabela

Botão "Tabela" abre popover com grid-picker hover (8 colunas × 6 linhas,
validado interativamente pelo usuário — mesma UX do Word/Excel: passa o mouse,
vê o tamanho, clica pra inserir). Extensões: `@tiptap/extension-table`,
`@tiptap/extension-table-row`, `@tiptap/extension-table-cell`,
`@tiptap/extension-table-header`.

Com o cursor dentro de uma tabela, controles contextuais aparecem na toolbar
(gate via `editor.isActive('table')`): adicionar/remover linha, adicionar/
remover coluna, apagar tabela. Fora de uma tabela, esses controles ficam
ocultos (não desabilitados — ocultos, pra não poluir a toolbar).

## Cor de texto & highlight

**Decisão:** paleta custom (não `<input type=color>` nativo — inconsistente
no tema escuro do app). Popover com ~8 cores fixas (mesmo swatch grid da
tabela): para cor de texto usa `@tiptap/extension-text-style` +
`@tiptap/extension-color`; para highlight usa `@tiptap/extension-highlight`
configurado com `multicolor: true`. Botão mostra a cor ativa; clique fora
fecha o popover.

## Lista de tarefas

`@tiptap/extension-task-list` + `@tiptap/extension-task-item` (checkbox
clicável inline, sincroniza como qualquer outro nó via Collaboration).

## Desfazer/Refazer

`@tiptap/extension-collaboration` (já em uso) expõe `editor.commands.undo()`/
`.redo()` via seu `Y.UndoManager` interno — não precisa de
`@tiptap/extension-history` (que aliás já está desligado). **Risco pequeno:**
confirmar que os comandos existem na v2.11.x pinada durante a implementação
(`editor.can().undo()`); se não existirem, plano B é instanciar um
`Y.UndoManager` manual escopado ao fragment `"default"` e expor botões que
chamam `.undo()`/`.redo()` direto nele.

## Contador de palavras/caracteres

`@tiptap/extension-character-count`. Fica na barra de status do editor (ao
lado de `doc {docId} · WS: {status}`), não na toolbar — é informação, não
ação.

## Fora de escopo

Fonte/tamanho de fonte · comentários/track changes · paginação real (page
breaks estilo Word — Tiptap não faz isso nativamente, exigiria extensão paga
ou trabalho pesado à parte, não vale pra este upgrade) · exportar
tabela/highlight no "Salvar como HTML" além do que o `editor.getHTML()`
padrão já gera.

## Dependências novas (10 pacotes)

```
@tiptap/extension-table
@tiptap/extension-table-row
@tiptap/extension-table-cell
@tiptap/extension-table-header
@tiptap/extension-text-style
@tiptap/extension-color
@tiptap/extension-highlight
@tiptap/extension-task-list
@tiptap/extension-task-item
@tiptap/extension-character-count
```

## Testes

`npm run typecheck` (frontend) · E2E manual clicando cada botão novo no
browser · sync colaborativo de tabela e highlight testado com 2 abas abertas
no mesmo doc.
