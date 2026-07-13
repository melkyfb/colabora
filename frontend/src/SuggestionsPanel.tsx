import type { Editor as TiptapEditor } from "@tiptap/react";
import { useEffect, useReducer } from "react";

interface Change {
  from: number;
  to: number;
  type: "insertion" | "deletion";
  author: string;
  text: string;
}

function collectChanges(editor: TiptapEditor): Change[] {
  const out: Change[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      if (mark.type.name !== "insertion" && mark.type.name !== "deletion") continue;
      const type = mark.type.name as Change["type"];
      const author = (mark.attrs["data-op-user-nickname"] as string) || "?";
      const last = out[out.length - 1];
      // funde trechos contiguos do mesmo tipo/autor num item so
      if (last && last.to === pos && last.type === type && last.author === author) {
        last.to = pos + node.nodeSize;
        last.text += node.text ?? "";
      } else {
        out.push({ from: pos, to: pos + node.nodeSize, type, author, text: node.text ?? "" });
      }
    }
  });
  return out;
}

export function SuggestionsPanel({ editor }: { editor: TiptapEditor | null }) {
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    if (!editor) return;
    editor.on("transaction", force);
    return () => {
      editor.off("transaction", force);
    };
  }, [editor]);

  if (!editor) return <p className="hint">Abra um documento.</p>;

  const changes = collectChanges(editor);

  function act(c: Change, accept: boolean) {
    if (!editor) return;
    // NUNCA encadear comandos do track-change apos focus()/setTextSelection no
    // mesmo chain: changeTrack() le editor.state.selection no momento da chamada
    // (nao o tr do chain) -> selecao errada. Comandos separados despacham em
    // sequencia e funcionam (validado no spike da Task 1).
    editor.commands.setTextSelection({ from: c.from, to: c.to });
    if (accept) editor.commands.acceptChange();
    else editor.commands.rejectChange();
  }

  return (
    <div className="panel">
      <h2>Sugestões</h2>
      {changes.length > 0 && (
        <div className="suggestion-all">
          {/* comandos diretos, sem chain (ver nota em act()) */}
          <button onClick={() => editor.commands.acceptAllChanges()}>Aceitar todas</button>
          <button className="ghost" onClick={() => editor.commands.rejectAllChanges()}>
            Rejeitar todas
          </button>
        </div>
      )}
      {changes.length === 0 && <p className="hint">Nenhuma sugestão pendente.</p>}
      {changes.map((c, i) => (
        <div key={`${c.from}-${i}`} className="suggestion-item">
          <div className="suggestion-type">
            {c.type === "insertion" ? "Inserção" : "Remoção"} · {c.author}
          </div>
          <div className="suggestion-text">{c.text}</div>
          <div className="comment-actions">
            <button onClick={() => act(c, true)}>Aceitar</button>
            <button className="ghost" onClick={() => act(c, false)}>
              Rejeitar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
