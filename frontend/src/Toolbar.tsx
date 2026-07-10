import type { Editor } from "@tiptap/react";
import { useState } from "react";

// ponytail: toolbar propria (8-12 botoes) em vez do scaffold Tiptap UI Components.
// Se o editor crescer (menus, dropdowns, temas), migrar pro oficial:
// https://tiptap.dev/docs/ui-components/components/overview
export function Toolbar({ editor, docId }: { editor: Editor; docId: string }) {
  const [showFileInput, setShowFileInput] = useState(false);

  const btn = (
    label: string,
    title: string,
    onClick: () => void,
    active = false,
  ) => (
    <button onClick={onClick} className={active ? "active" : ""} title={title}>
      {label}
    </button>
  );

  return (
    <div className="toolbar">
      {btn("B", "Negrito", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
      {btn("I", "Itálico", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
      {btn("U", "Sublinhado", () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"))}

      <span className="sep" />

      {btn("⬅", "Alinhar à esquerda", () => editor.chain().focus().setTextAlign("left").run(), editor.isActive({ textAlign: "left" }))}
      {btn("↔", "Centralizar", () => editor.chain().focus().setTextAlign("center").run(), editor.isActive({ textAlign: "center" }))}
      {btn("➡", "Alinhar à direita", () => editor.chain().focus().setTextAlign("right").run(), editor.isActive({ textAlign: "right" }))}
      {btn("☰", "Justificar", () => editor.chain().focus().setTextAlign("justify").run(), editor.isActive({ textAlign: "justify" }))}

      <span className="sep" />

      {btn("•", "Lista com marcadores", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
      {btn("1.", "Lista numerada", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}

      <span className="sep" />

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
      {btn("🖼️", "Inserir imagem", () => setShowFileInput(true))}

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

      {showFileInput && (
        <input
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const base64 = await fileToBase64(file);
            editor.chain().focus().setImage({ src: base64, alt: file.name }).run();
            setShowFileInput(false);
          }}
          style={{ position: "absolute", left: "-9999px" }}
        />
      )}
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
