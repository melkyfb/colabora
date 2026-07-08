import { HocuspocusProvider } from "@hocuspocus/provider";
import Collaboration from "@tiptap/extension-collaboration";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";

import { WS_URL } from "./config";

export function Editor({ token, docId }: { token: string; docId: string }) {
  const [status, setStatus] = useState("conectando...");

  // novo Y.Doc + provider por documento aberto
  const ydoc = useMemo(() => new Y.Doc(), [docId]);
  const provider = useMemo(
    () =>
      new HocuspocusProvider({
        url: WS_URL,
        name: docId, // documentName == id do Document (convencao do backend)
        token,
        document: ydoc,
        onAuthenticationFailed: () => setStatus("NAO AUTORIZADO"),
        onStatus: (e: { status: string }) => setStatus(e.status),
      }),
    [ydoc, docId, token],
  );

  const editor = useEditor(
    {
      extensions: [
        // Collaboration ja provê historico -> desligar o do StarterKit
        StarterKit.configure({ history: false }),
        Collaboration.configure({ document: ydoc }),
      ],
    },
    [ydoc],
  );

  useEffect(
    () => () => {
      provider.destroy();
      ydoc.destroy();
    },
    [provider, ydoc],
  );

  return (
    <section className="editor">
      <div className="status">
        doc {docId} · WS: {status}
      </div>
      <EditorContent editor={editor} className="prose" />
    </section>
  );
}
