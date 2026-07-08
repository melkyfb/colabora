import { useState } from "react";

import { ragChat, type ChatReply } from "./api";

export function AiSidebar({ token }: { token: string }) {
  const [q, setQ] = useState("");
  const [reply, setReply] = useState<ChatReply | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function ask() {
    setLoading(true);
    setErr("");
    setReply(null);
    try {
      setReply(await ragChat(token, q));
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="sidebar">
      <h2>Assistente IA</h2>
      <textarea
        placeholder="Pergunte sobre os documentos..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <button onClick={ask} disabled={loading || !q}>
        {loading ? "..." : "Perguntar"}
      </button>
      {err && <p className="err">{err}</p>}
      {reply && (
        <div className="reply">
          <p>{reply.answer}</p>
          {reply.sources.length > 0 && (
            <details>
              <summary>{reply.sources.length} fonte(s)</summary>
              {reply.sources.map((s, i) => (
                <div key={i} className="src">
                  [doc {s.documentId}] {s.text.slice(0, 160)}…
                </div>
              ))}
            </details>
          )}
        </div>
      )}
    </aside>
  );
}
