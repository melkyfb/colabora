import type { Editor as TiptapEditor } from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";

import { listComments, type CommentOut, type MeOut } from "./api";

export function CommentsPanel({
  token,
  docId,
  editor,
  me,
  canEdit,
  activeMarkId,
  draftMarkId,
  onDraftDone,
}: {
  token: string;
  docId: string;
  editor: TiptapEditor | null;
  me: MeOut;
  canEdit: boolean;
  activeMarkId: string | null;
  draftMarkId: string | null;
  onDraftDone: () => void;
}) {
  void editor;
  void me;
  void canEdit;
  void draftMarkId;
  void onDraftDone;

  const [comments, setComments] = useState<CommentOut[]>([]);
  const [err, setErr] = useState("");

  const reload = useCallback(() => {
    listComments(token, docId)
      .then(setComments)
      .catch((e) => setErr(String(e)));
  }, [token, docId]);

  useEffect(reload, [reload]);

  const roots = comments.filter((c) => c.parent_id === null);
  const repliesOf = (root: CommentOut) => comments.filter((c) => c.parent_id === root.id);

  function scrollToMark(markId: string) {
    document
      .querySelector(`span[data-comment-id="${markId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="panel">
      <h2>Comentários</h2>
      {err && <p className="err">{err}</p>}
      {roots.length === 0 && <p className="hint">Nenhum comentário neste documento.</p>}
      {roots.map((root) => (
        <div
          key={root.id}
          className={
            "comment-thread" +
            (root.mark_id === activeMarkId ? " active" : "") +
            (root.resolved ? " resolved" : "")
          }
          onClick={() => scrollToMark(root.mark_id)}
        >
          <div className="comment-item">
            <div className="comment-author">
              {root.author_name} · {new Date(root.created_at).toLocaleString("pt-BR")}
              {root.resolved ? " · resolvido" : ""}
            </div>
            <div className="comment-body">{root.body}</div>
          </div>
          {repliesOf(root).map((r) => (
            <div key={r.id} className="comment-item comment-reply">
              <div className="comment-author">
                {r.author_name} · {new Date(r.created_at).toLocaleString("pt-BR")}
              </div>
              <div className="comment-body">{r.body}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
