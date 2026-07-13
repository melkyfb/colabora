import type { Editor as TiptapEditor } from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";

import {
  createComment,
  deleteComment,
  listComments,
  updateComment,
  type CommentOut,
  type MeOut,
} from "./api";

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
  const [comments, setComments] = useState<CommentOut[]>([]);
  const [draftBody, setDraftBody] = useState("");
  const [replyFor, setReplyFor] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [err, setErr] = useState("");

  const reload = useCallback(() => {
    listComments(token, docId)
      .then(setComments)
      .catch((e) => setErr(String(e)));
  }, [token, docId]);

  useEffect(reload, [reload]);

  const roots = comments.filter((c) => c.parent_id === null);
  const repliesOf = (root: CommentOut) => comments.filter((c) => c.parent_id === root.id);
  const canTouch = (c: CommentOut) => canEdit || c.author_id === me.id;

  function scrollToMark(markId: string) {
    document
      .querySelector(`span[data-comment-id="${markId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function submitDraft() {
    if (!draftMarkId || !draftBody.trim()) return;
    try {
      await createComment(token, docId, { mark_id: draftMarkId, body: draftBody.trim() });
      setDraftBody("");
      onDraftDone();
      reload();
    } catch (e) {
      setErr(String(e));
    }
  }

  function cancelDraft() {
    if (draftMarkId) editor?.commands.unsetComment(draftMarkId);
    setDraftBody("");
    onDraftDone();
  }

  async function submitReply(root: CommentOut) {
    if (!replyBody.trim()) return;
    try {
      await createComment(token, docId, {
        mark_id: root.mark_id,
        body: replyBody.trim(),
        parent_id: root.id,
      });
      setReplyBody("");
      setReplyFor(null);
      reload();
    } catch (e) {
      setErr(String(e));
    }
  }

  async function toggleResolved(root: CommentOut) {
    try {
      await updateComment(token, root.id, { resolved: !root.resolved });
      reload();
    } catch (e) {
      setErr(String(e));
    }
  }

  async function removeThread(root: CommentOut) {
    try {
      await deleteComment(token, root.id); // cascade apaga replies
      editor?.commands.unsetComment(root.mark_id);
      reload();
    } catch (e) {
      setErr(String(e));
    }
  }

  return (
    <div className="panel">
      <h2>Comentários</h2>
      {err && <p className="err">{err}</p>}

      {draftMarkId && (
        <div className="comment-thread active comment-composer">
          <textarea
            autoFocus
            placeholder="Escreva o comentário..."
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
          />
          <div className="comment-actions">
            <button onClick={submitDraft} disabled={!draftBody.trim()}>
              Comentar
            </button>
            <button className="ghost" onClick={cancelDraft}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {roots.length === 0 && !draftMarkId && (
        <p className="hint">Nenhum comentário neste documento.</p>
      )}

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

          <div className="comment-actions" onClick={(e) => e.stopPropagation()}>
            {canEdit && (
              <button onClick={() => setReplyFor(replyFor === root.id ? null : root.id)}>
                Responder
              </button>
            )}
            {canTouch(root) && (
              <button onClick={() => toggleResolved(root)}>
                {root.resolved ? "Reabrir" : "Resolver"}
              </button>
            )}
            {canTouch(root) && (
              <button className="ghost" onClick={() => removeThread(root)}>
                Apagar
              </button>
            )}
          </div>

          {replyFor === root.id && (
            <div className="comment-composer" onClick={(e) => e.stopPropagation()}>
              <textarea
                autoFocus
                placeholder="Responder..."
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
              />
              <div className="comment-actions">
                <button onClick={() => submitReply(root)} disabled={!replyBody.trim()}>
                  Enviar
                </button>
                <button className="ghost" onClick={() => setReplyFor(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
