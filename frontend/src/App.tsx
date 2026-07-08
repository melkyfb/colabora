import { useState } from "react";

import { AiSidebar } from "./AiSidebar";
import { createDocument } from "./api";
import { Editor } from "./Editor";
import { Login } from "./Login";

export function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("nyx_token"));
  const [docId, setDocId] = useState("");
  const [docInput, setDocInput] = useState("1");

  function setTok(t: string) {
    localStorage.setItem("nyx_token", t);
    setToken(t);
  }
  function logout() {
    localStorage.removeItem("nyx_token");
    setToken(null);
    setDocId("");
  }

  async function newDoc() {
    if (!token) return;
    const d = await createDocument(token, "Documento sem titulo");
    setDocInput(String(d.id));
    setDocId(String(d.id));
  }

  if (!token) return <Login onToken={setTok} />;

  return (
    <div className="app">
      <header>
        <strong>Nyx Platform</strong>
        <span className="spacer" />
        <input
          value={docInput}
          onChange={(e) => setDocInput(e.target.value)}
          style={{ width: 56 }}
          aria-label="id do documento"
        />
        <button onClick={() => setDocId(docInput)}>Abrir doc</button>
        <button onClick={newDoc}>Novo doc</button>
        <button onClick={logout}>Sair</button>
      </header>
      <main>
        {docId ? (
          <Editor token={token} docId={docId} />
        ) : (
          <p className="hint">Abra um doc existente (por id) ou crie um novo.</p>
        )}
        <AiSidebar token={token} />
      </main>
    </div>
  );
}
