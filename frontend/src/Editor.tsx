import { HocuspocusProvider } from "@hocuspocus/provider";
import Collaboration from "@tiptap/extension-collaboration";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";

import { WS_URL } from "./config";

export function Editor({ token, docId }: { token: string; docId: string }) {
  const [status, setStatus] = useState("conectando...");
  const [showFileInput, setShowFileInput] = useState(false);

  // novo Y.Doc + provider por documento aberto
  const ydoc = useMemo(() => new Y.Doc(), [docId]);
  const provider = useMemo(() => {
    if (!token) return null;
    return new HocuspocusProvider({
      url: WS_URL,
      name: docId,
      token,
      document: ydoc,
      onAuthenticationFailed: () => setStatus("NAO AUTORIZADO"),
      onStatus: (e: { status: string }) => setStatus(e.status),
    });
  }, [ydoc, docId, token]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ history: false }),
        Collaboration.configure({
          document: ydoc,
        }),
        Image,
        Underline,
      ],
    },
    [ydoc],
  );

  useEffect(() => {
    return () => {
      provider?.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  if (!token) {
    return <p className="hint">Token ausente — faca login novamente.</p>;
  }

  if (!editor) {
    return <p className="hint">Carregando editor...</p>;
  }

  return (
    <section className="editor">
      <div className="status">
        doc {docId} · WS: {status}
      </div>
      <div className="toolbar">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'active' : ''}
          title="Negrito"
        >
          B
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'active' : ''}
          title="Itálico"
        >
          I
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive('underline') ? 'active' : ''}
          title="Sublinhado"
        >
          U
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'active' : ''}
          title="Lista com marcadores"
        >
          •
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'active' : ''}
          title="Lista numerada"
        >
          1.
        </button>
        <button
          onClick={() => {
            const url = prompt('Enter the URL');
            if (url === null) return; // user canceled
            if (url === '') {
              editor.chain().focus().toggleLink().run();
            } else {
              editor.chain().focus().setLink({ href: url }).run();
            }
          }}
          className={editor.isActive('link') ? 'active' : ''}
          title="Link"
        >
          🔗
        </button>
        <button
          onClick={() => setShowFileInput(true)}
          title="Inserir imagem"
        >
          🖼️
        </button>
        <button
          onClick={() => {
            const html = editor.getHTML();
            const blob = new Blob([html], { type: "text/html" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `documento-${docId}.html`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          title="Salvar como HTML"
        >
          💾
        </button>
        <button
          onClick={() => window.print()}
          title="Imprimir / Salvar como PDF"
        >
          🖨️
        </button>
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
      <EditorContent editor={editor} className="prose" />
    </section>
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