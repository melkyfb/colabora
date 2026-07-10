# Design — Comentários & Track Changes (2026-07-10)

Aprovado pelo usuário em 2026-07-10. Sub-projeto adicional, paralelo ao
`2026-07-10-editor-toolbar-upgrade-design.md` (que explicitamente excluiu
estes dois recursos por escopo/tamanho — este spec os traz de volta como um
sub-projeto próprio).

## Contexto e decisão de licenciamento

O usuário tem um token de registro privado Tiptap Pro (`.npmrc`,
`@tiptap-pro:registry=https://registry.tiptap.dev/`), mas **sem assinatura
paga ativa** (confirmado com o usuário). Pesquisa nas docs oficiais mostrou:

- `@tiptap-pro/extension-comments` (`CommentsKit`) — **exige assinatura ativa**
  ("Select extensions such as Snapshots, Comments... require an active
  subscription") e a documentação aponta pro "Document server"/Environment do
  Tiptap Cloud, não confirma funcionamento com Hocuspocus self-hosted puro.
  Usar isso reintroduziria um segundo backend de tempo real (nuvem deles),
  contrariando a arquitetura self-hosted do projeto.
- `@tiptap-pro/extension-tracked-changes` (`TrackedChanges`) — **experimental,
  API instável, marcado como pré-1.0**. Status de assinatura não confirmado
  na doc, mas mesmo se gratuito, a instabilidade de API é um risco por si só.

**Decisão: usar as alternativas open-source, self-hosted, gratuitas:**

- Comentários: [`@sereneinserenade/tiptap-comment-extension`](https://github.com/sereneinserenade/tiptap-comment-extension)
  (npm, v0.2.0 mar/2026, 44 commits, ativo). Comandos `setComment`/
  `unsetComment`. Não traz storage — a aplicação consumidora provê (nós já
  temos FastAPI+MySQL, mesmo padrão do resto do projeto).
- Track changes: [`chenyuncai/tiptap-track-change-extension`](https://github.com/chenyuncai/tiptap-track-change-extension)
  (MIT). Comandos `acceptChange`/`rejectChange`/`acceptAllChange`/
  `rejectAllChange`, atribuição via `dataOpUserId`/`dataOpUserNickname`, CSS
  de insert/delete fornecido pela própria doc. Instalável via npm ou como
  arquivo TS vendorizado (baixo lock-in caso precise de fork/manutenção).

## Comentários

### Dados (backend)

Nova tabela `comments` (Alembic migration):

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | int PK | |
| `document_id` | FK `documents.id` | cascade delete |
| `mark_id` | string (uuid) | gerado no client, é o id usado por `setComment()` |
| `author_id` | FK `users.id` | |
| `parent_id` | FK `comments.id` nullable | reply em thread |
| `body` | text | |
| `resolved` | bool default false | |
| `created_at`/`updated_at` | datetime | |

### Endpoints (backend-api)

Reaproveita `_authorize(db, user, doc, "view"|"edit")` já existente em
`documents.py` — sem policy Cerbos nova. Autoria (só o próprio autor ou quem
tem `edit` no doc pode editar/apagar um comentário) é checagem simples no
router, mesmo padrão de `owner_id` já usado no projeto.

- `GET /api/documents/{id}/comments` — lista threads (autz: `view`)
- `POST /api/documents/{id}/comments` — cria comentário/reply (autz: `edit`)
- `PATCH /api/comments/{comment_id}` — edita corpo ou `resolved` (autor ou `edit`)
- `DELETE /api/comments/{comment_id}` — apaga (autor ou `edit`)

### Frontend

- Registra `CommentExtension` no `Editor.tsx` com `onCommentActivated(id)` →
  seleciona/rola até o thread na sidebar.
- Toolbar ganha botão 💬: com seleção de texto ativa, gera um `mark_id`
  (uuid), chama `setComment(mark_id)`, abre a sidebar na aba Comentários com
  um campo vazio pro primeiro comentário da thread.
- Sidebar direita ganha abas **IA | Comentários** (reusa `.sidebar` já
  existente, troca o conteúdo por aba ativa). Aba Comentários lista threads
  (hidrata via `GET .../comments` ao abrir o doc), permite reply, resolver e
  apagar (conforme permissão).

## Track Changes

### Amarração com ABAC (Cerbos) — o motivo de valor real

Usuários com só `view` (ex.: `engineer_l1`) ficam **sempre em modo sugestão**
— não editam direto, só propõem. Usuários com `edit` decidem ligar/desligar
o modo sugestão pra si e podem aceitar/rejeitar qualquer sugestão pendente.
Isso dá função real ao recurso em vez de ser só um botão a mais.

Precisa 1 campo novo na resposta de `GET /api/documents/{id}`:
`canEdit: bool` (o backend já roda o check Cerbos `edit` internamente pra
outras rotas — só expor o resultado).

### Frontend

- `TrackChangeExtension.configure({ enabled, dataOpUserId, dataOpUserNickname })`.
  `enabled` = `!canEdit || toggleManual` (viewer sempre true; editor com o
  toggle ligado também true).
- Toolbar: toggle "Modo sugestão" (só visível/ativável pra quem tem `edit`;
  pra viewer aparece sempre ligado e desabilitado, com tooltip explicando).
- Painel/lista de sugestões pendentes com botões aceitar/rejeitar (individual
  e "aceitar todas"/"rejeitar todas") — visível só pra quem tem `edit`.
- CSS: inserção = sublinhado verde, deleção = tachado vermelho (convenção
  Word/GDocs, já sugerida pela doc da lib).

### Risco a validar antes de construir a UI

A doc da extensão não confirma compatibilidade com Y.js/Collaboration (ela
intercepta transações ProseMirror; Y.js aplica as suas próprias pra
sincronizar). **Primeira tarefa do plano de implementação é um spike
isolado**: registrar `TrackChangeExtension` junto com `Collaboration` num
editor de teste, confirmar que aceitar/rejeitar não corrompe o estado
sincronizado entre 2 clientes, antes de construir toolbar/painel em cima.
Se conflitar: plano B é reavaliar Tiptap Pro (mesmo experimental) ou adiar
o recurso.

## Fora de escopo (deste spec)

Resolução automática de conflito entre sugestões concorrentes de dois
usuários no mesmo trecho (deixa pro usuário resolver manualmente) ·
notificações de novo comentário (email/push) · menções (@usuario) em
comentários.

## Testes

Migration Alembic aplicada e revertida (`upgrade`/`downgrade`) · endpoints de
comentário testados via curl/Postman com os 2 papéis (dono vs outro editor) ·
spike de track-changes + Collaboration validado com 2 abas antes de seguir ·
`tsc --noEmit` no frontend · E2E manual: criar thread, responder, resolver,
alternar modo sugestão como viewer vs editor, aceitar/rejeitar sugestão.
