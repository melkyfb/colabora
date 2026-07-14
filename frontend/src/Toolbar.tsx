import type { Editor } from "@tiptap/react";
import { useRef } from "react";

import { TablePicker } from "./toolbar/TablePicker";
import { ColorSwatchPicker } from "./toolbar/ColorSwatchPicker";

const TEXT_COLORS = ["#e6e9ef", "#e24b4a", "#facc15", "#4ade80", "#38bdf8", "#a78bfa", "#f472b6", "#8b93a7"];
const HIGHLIGHT_COLORS = ["#facc15", "#4ade80", "#38bdf8", "#f472b6", "#fb923c", "#a78bfa", "#e24b4a", "#e6e9ef"];

// ponytail: toolbar propria (8-12 botoes) em vez do scaffold Tiptap UI Components.
// Se o editor crescer (menus, dropdowns, temas), migrar pro oficial:
// https://tiptap.dev/docs/ui-components/components/overview
export function Toolbar({
  editor,
  docId,
  canEdit,
  onNewComment,
  suggesting,
  onToggleSuggesting,
  onImportFile,
}: {
  editor: Editor;
  docId: string;
  canEdit: boolean;
  onNewComment: (markId: string) => void;
  suggesting: boolean;
  onToggleSuggesting: () => void;
  onImportFile: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const btn = (
    label: string,
    title: string,
    onClick: () => void,
    active = false,
    disabled = false,
  ) => (
    <button onClick={onClick} disabled={disabled} className={active ? "active" : ""} title={title}>
      {label}
    </button>
  );

  const activeHeading = ([1, 2, 3] as const).find((level) => editor.isActive("heading", { level })) ?? 0;

  return (
    <div className="toolbar">
      <div className="toolbar-row">
        <select
          className="heading-select"
          title="Estilo de paragrafo"
          value={activeHeading}
          onChange={(e) => {
            const level = Number(e.target.value);
            if (level === 0) editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run();
          }}
        >
          <option value={0}>Normal</option>
          <option value={1}>Titulo 1</option>
          <option value={2}>Titulo 2</option>
          <option value={3}>Titulo 3</option>
        </select>

        <span className="sep" />

        {btn("B", "Negrito", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
        {btn("I", "Itálico", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
        {btn("U", "Sublinhado", () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"))}
        {btn("S", "Tachado", () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"))}

        <ColorSwatchPicker
          label="A"
          title="Cor do texto"
          colors={TEXT_COLORS}
          activeColor={TEXT_COLORS.find((c) => editor.isActive("textStyle", { color: c })) ?? null}
          onPick={(c) => editor.chain().focus().setColor(c).run()}
          onClear={() => editor.chain().focus().unsetColor().run()}
        />
        <ColorSwatchPicker
          label="A"
          title="Marca-texto"
          colors={HIGHLIGHT_COLORS}
          activeColor={HIGHLIGHT_COLORS.find((c) => editor.isActive("highlight", { color: c })) ?? null}
          onPick={(c) => editor.chain().focus().setHighlight({ color: c }).run()}
          onClear={() => editor.chain().focus().unsetHighlight().run()}
        />

        <span className="sep" />

        {btn("↶", "Desfazer", () => editor.chain().focus().undo().run(), false, !editor.can().undo())}
        {btn("↷", "Refazer", () => editor.chain().focus().redo().run(), false, !editor.can().redo())}

        <span className="sep" />

        {btn(
          "✎ Sugestão",
          canEdit
            ? "Modo sugestão: suas edições viram sugestões para aceitar/rejeitar"
            : "Modo sugestão sempre ativo: você não tem permissão de edição direta",
          () => canEdit && onToggleSuggesting(),
          suggesting,
          !canEdit,
        )}
      </div>

      <div className="toolbar-row">
        {btn("⬅", "Alinhar à esquerda", () => editor.chain().focus().setTextAlign("left").run(), editor.isActive({ textAlign: "left" }))}
        {btn("↔", "Centralizar", () => editor.chain().focus().setTextAlign("center").run(), editor.isActive({ textAlign: "center" }))}
        {btn("➡", "Alinhar à direita", () => editor.chain().focus().setTextAlign("right").run(), editor.isActive({ textAlign: "right" }))}
        {btn("☰", "Justificar", () => editor.chain().focus().setTextAlign("justify").run(), editor.isActive({ textAlign: "justify" }))}

        <span className="sep" />

        {btn("•", "Lista com marcadores", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
        {btn("1.", "Lista numerada", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
        {btn("☑", "Lista de tarefas", () => editor.chain().focus().toggleTaskList().run(), editor.isActive("taskList"))}

        <span className="sep" />

        {btn("”", "Citação", () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}
        {btn("</>", "Bloco de codigo", () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive("codeBlock"))}
        {btn("―", "Linha horizontal", () => editor.chain().focus().setHorizontalRule().run())}

        <span className="sep" />

        <TablePicker
          onInsert={(rows, cols) => editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()}
        />
        {btn("🖼️", "Inserir imagem", () => fileInputRef.current?.click())}
        {btn(
          "🔗",
          "Link",
          () => {
            const url = prompt("URL do link");
            if (url === null) return;
            if (url === "") editor.chain().focus().unsetLink().run();
            else editor.chain().focus().setLink({ href: url }).run();
          },
          editor.isActive("link"),
        )}
        {btn(
          "💬",
          canEdit ? "Comentar (selecione um texto)" : "Comentar (requer permissão de edição)",
          () => {
            if (editor.state.selection.empty) return;
            const markId = crypto.randomUUID();
            editor.chain().focus().setComment(markId).run();
            onNewComment(markId);
          },
          false,
          !canEdit,
        )}
        {btn(
          "📥",
          canEdit ? "Importar PDF/DOCX no documento" : "Importar (requer permissão de edição)",
          () => importInputRef.current?.click(),
          false,
          !canEdit,
        )}

        {editor.isActive("table") && (
          <>
            <span className="sep" />
            {btn("+Lin", "Adicionar linha", () => editor.chain().focus().addRowAfter().run())}
            {btn("-Lin", "Remover linha", () => editor.chain().focus().deleteRow().run())}
            {btn("+Col", "Adicionar coluna", () => editor.chain().focus().addColumnAfter().run())}
            {btn("-Col", "Remover coluna", () => editor.chain().focus().deleteColumn().run())}
            {btn("🗑Tab", "Apagar tabela", () => editor.chain().focus().deleteTable().run())}
          </>
        )}

        <span className="sep" />

        {btn("💾", "Salvar como HTML", () => {
          const html = editor.getHTML();
          const blob = new Blob([html], { type: "text/html" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `documento-${docId}.html`;
          a.click();
          URL.revokeObjectURL(url);
        })}
        {btn("🖨️", "Imprimir / Salvar como PDF", () => window.print())}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const base64 = await fileToBase64(file);
            editor.chain().focus().setImage({ src: base64, alt: file.name }).run();
            e.target.value = "";
          }}
          style={{ display: "none" }}
        />
        <input
          ref={importInputRef}
          type="file"
          accept=".pdf,.docx"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImportFile(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}
