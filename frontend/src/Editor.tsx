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
import CharacterCount from "@tiptap/extension-character-count";
import { TrackChangeExtension } from "./extensions/track-change";
import { CommentExtension } from "@sereneinserenade/tiptap-comment-extension";
import TextStyle from "@tiptap/extension-text-style";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState } from "react";
import * as Y from "yjs";

import { getDocument, updateDocument } from "./api";
import type { MeOut } from "./api";
import { handleAuthFailure } from "./auth";
import { WS_URL } from "./config";
import { Toolbar } from "./Toolbar";

export function Editor({
  token,
  docId,
  me,
  onEditorReady,
  onCanEdit,
  onCommentActivated,
  onNewComment,
}: {
  token: string;
  docId: string;
  me: MeOut;
  onEditorReady: (editor: import("@tiptap/react").Editor | null) => void;
  onCanEdit: (canEdit: boolean) => void;
  onCommentActivated: (markId: string | null) => void;
  onNewComment: (markId: string) => void;
}) {
  void me;
  const [status, setStatus] = useState("conectando...");
  const [title, setTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
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
      onAuthenticationFailed: () => {
        setStatus("NAO AUTORIZADO");
        handleAuthFailure();
      },
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
      .then((d) => {
        if (!alive) return;
        setTitle(d.title);
        onCanEdit(d.can_edit);
        setCanEdit(d.can_edit);
      })
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
      <EditorArea
        key={docId}
        ydoc={conn.ydoc}
        docId={docId}
        onEditorReady={onEditorReady}
        onCommentActivated={onCommentActivated}
        onNewComment={onNewComment}
        canEdit={canEdit}
      />
    </section>
  );
}

// useEditor vive num filho: so monta quando o ydoc/provider ja existem
function EditorArea({
  ydoc,
  docId,
  onEditorReady,
  onCommentActivated,
  onNewComment,
  canEdit,
}: {
  ydoc: Y.Doc;
  docId: string;
  onEditorReady: (editor: import("@tiptap/react").Editor | null) => void;
  onCommentActivated: (markId: string | null) => void;
  onNewComment: (markId: string) => void;
  canEdit: boolean;
}) {
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
        CharacterCount,
        TrackChangeExtension.configure({ enabled: false }),
        CommentExtension.configure({
          HTMLAttributes: { class: "comment-mark" },
          onCommentActivated: (commentId: string) => onCommentActivated(commentId || null),
        }),
      ],
    },
    [ydoc],
  );

  useEffect(() => {
    onEditorReady(editor);
    return () => onEditorReady(null);
  }, [editor]);

  if (!editor) return <p className="hint">Carregando editor...</p>;
  return (
    <>
      <Toolbar editor={editor} docId={docId} canEdit={canEdit} onNewComment={onNewComment} />
      <div className="wordcount">
        {editor.storage.characterCount.words()} palavras · {editor.storage.characterCount.characters()} caracteres
      </div>
      <EditorContent editor={editor} className="prose" />
    </>
  );
}
