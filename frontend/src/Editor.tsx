import { HocuspocusProvider } from "@hocuspocus/provider";
import Collaboration from "@tiptap/extension-collaboration";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import Underline from "@tiptap/extension-underline";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextStyle from "@tiptap/extension-text-style";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState } from "react";
import * as Y from "yjs";

import { getDocument, updateDocument } from "./api";
import { WS_URL } from "./config";
import { Toolbar } from "./Toolbar";

export function Editor({ token, docId }: { token: string; docId: string }) {
  const [status, setStatus] = useState("conectando...");
  const [title, setTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  // provider criado em useEffect (nao useMemo): StrictMode monta/desmonta 2x em dev,
  // e useMemo deixava um provider zumbi conectando + o ativo destruido -> backoff de
  // reconexao segurava o "connecting" por ~10s. Aqui cada mount cria e destroi o seu.
  const [conn, setConn] = useState<{ ydoc: Y.Doc; provider: HocuspocusProvider } | null>(null);

  useEffect(() => {
    if (!token) return;
    const ydoc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: WS_URL,
      name: docId, // documentName == id do Document (convencao do backend)
      token,
      document: ydoc,
      onAuthenticationFailed: () => setStatus("NAO AUTORIZADO"),
      onStatus: (e: { status: string }) => setStatus(e.status),
    });
    setConn({ ydoc, provider });
    return () => {
      provider.destroy();
      ydoc.destroy();
      setConn(null);
    };
  }, [docId, token]);

  // titulo do documento (F4)
  useEffect(() => {
    let alive = true;
    getDocument(token, docId)
      .then((d) => alive && setTitle(d.title))
      .catch(() => alive && setTitle(""));
    return () => {
      alive = false;
    };
  }, [token, docId]);

  async function saveTitle(next: string) {
    setEditingTitle(false);
    const t = next.trim();
    if (!t || t === title) return;
    try {
      await updateDocument(token, docId, { title: t });
      setTitle(t);
    } catch {
      // sem permissao de edit -> mantem o titulo antigo
    }
  }

  if (!token) return <p className="hint">Token ausente — faca login novamente.</p>;
  if (!conn) return <p className="hint">Conectando ao documento...</p>;

  return (
    <section className="editor">
      <div className="status">
        {editingTitle ? (
          <input
            className="title-input"
            autoFocus
            defaultValue={title}
            onBlur={(e) => saveTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditingTitle(false);
            }}
          />
        ) : (
          <span className="title" title="Clique para renomear" onClick={() => setEditingTitle(true)}>
            {title || `doc ${docId}`}
          </span>
        )}
        <span className="meta">
          doc {docId} · WS: {status}
        </span>
      </div>
      <EditorArea key={docId} ydoc={conn.ydoc} docId={docId} />
    </section>
  );
}

// useEditor vive num filho: so monta quando o ydoc/provider ja existem
function EditorArea({ ydoc, docId }: { ydoc: Y.Doc; docId: string }) {
  const editor = useEditor(
    {
      extensions: [
        // Collaboration ja provê historico -> desligar o do StarterKit
        StarterKit.configure({ history: false }),
        Collaboration.configure({ document: ydoc }),
        Image,
        Underline,
        Link.configure({ openOnClick: false }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Table.configure({ resizable: false }),
        TableRow,
        TableHeader,
        TableCell,
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
      ],
    },
    [ydoc],
  );

  if (!editor) return <p className="hint">Carregando editor...</p>;
  return (
    <>
      <Toolbar editor={editor} docId={docId} />
      <EditorContent editor={editor} className="prose" />
    </>
  );
}
