import { useEffect, useState } from "react";

import { AiSidebar } from "./AiSidebar";
import { createDocument } from "./api";
import { clearTokens, getAccessToken, refreshAccessToken, registerAuthHandlers, setTokens, tokenExpiryMs } from "./auth";
import { Editor } from "./Editor";
import { Login } from "./Login";

// margem antes do "exp" pra disparar o refresh silencioso (evita a janela
// onde o access token ja morreu mas o timer ainda nao disparou).
const REFRESH_MARGIN_MS = 60_000;

export function App() {
  const [token, setToken] = useState<string | null>(() => getAccessToken());
  const [docId, setDocId] = useState("");
  const [docInput, setDocInput] = useState("1");

  function setTok(access: string, refresh: string) {
    setTokens(access, refresh);
    setToken(access);
  }
  function logout() {
    clearTokens();
    setToken(null);
    setDocId("");
  }

  // handlers globais: authedFetch (api.ts) e a conexao WS (Editor.tsx) chamam
  // isso quando um token expira/e renovado, sem precisar de prop-drilling.
  useEffect(() => {
    registerAuthHandlers({ onTokenRefreshed: setToken, onLogout: logout });
  }, []);

  // refresh proativo: renova o access token pouco antes de vencer, mantendo a
  // sessao viva sem interromper o usuario. So desloga de fato se o refresh
  // token tambem estiver vencido/invalido (deps.py/security.py) -- ai sim
  // "deve dar logout quando expirar o token".
  useEffect(() => {
    if (!token) return;
    const exp = tokenExpiryMs(token);
    if (!exp) return;

    const msUntilRefresh = Math.max(0, exp - Date.now() - REFRESH_MARGIN_MS);
    const id = setTimeout(async () => {
      const newAccess = await refreshAccessToken();
      if (newAccess) setToken(newAccess);
      else logout();
    }, msUntilRefresh);
    return () => clearTimeout(id);
  }, [token]);

  function openDoc(id: string) {
    setDocInput(id);
    setDocId(id);
  }

  async function newDoc() {
    if (!token) return;
    const name = prompt("Nome do documento:");
    if (name === null) return;
    const d = await createDocument(token, name.trim() || "Documento sem titulo");
    openDoc(String(d.id));
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
        <AiSidebar token={token} onOpenDoc={openDoc} />
      </main>
    </div>
  );
}
