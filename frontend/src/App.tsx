import { useEffect, useRef, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/react";

import { convertDocument, createDocument, deleteDocument, fetchMe, type MeOut } from "./api";
import { clearTokens, getAccessToken, refreshAccessToken, registerAuthHandlers, setTokens, tokenExpiryMs } from "./auth";
import { Editor } from "./Editor";
import { Login } from "./Login";
import { Sidebar, type SidebarTab } from "./Sidebar";

// margem antes do "exp" pra disparar o refresh silencioso (evita a janela
// onde o access token ja morreu mas o timer ainda nao disparou).
const REFRESH_MARGIN_MS = 60_000;

export function App() {
  const [token, setToken] = useState<string | null>(() => getAccessToken());
  const [docId, setDocId] = useState("");
  const [docInput, setDocInput] = useState("1");
  const [me, setMe] = useState<MeOut | null>(null);
  const [editorInst, setEditorInst] = useState<TiptapEditor | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [tab, setTab] = useState<SidebarTab>("ia");
  const [activeMarkId, setActiveMarkId] = useState<string | null>(null);
  const [draftMarkId, setDraftMarkId] = useState<string | null>(null);
  const [meErr, setMeErr] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ docId: string; html: string } | null>(null);
  const [importErr, setImportErr] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) {
      setMe(null);
      return;
    }
    setMeErr(false);
    // 401 ja derruba a sessao via authedFetch/handleAuthFailure; aqui so
    // sinalizamos falhas nao-auth (500/rede) pra nao travar em "Carregando".
    fetchMe(token).then(setMe).catch(() => setMeErr(true));
  }, [token]);

  function setTok(access: string, refresh: string) {
    setTokens(access, refresh);
    setToken(access);
  }
  function logout() {
    clearTokens();
    setToken(null);
    setDocId("");
    setMe(null);
    setTab("ia");
    setActiveMarkId(null);
    setDraftMarkId(null);
    setCanEdit(false);
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
    setActiveMarkId(null);
    setDraftMarkId(null);
    setCanEdit(false);
  }

  async function newDoc() {
    if (!token) return;
    const name = prompt("Nome do documento:");
    if (name === null) return;
    const d = await createDocument(token, name.trim() || "Documento sem titulo");
    openDoc(String(d.id));
  }

  async function importDoc(file: File) {
    if (!token) return;
    setImportErr("");
    const title = file.name.replace(/\.[^.]+$/, "") || "Documento importado";
    const d = await createDocument(token, title);
    try {
      const { html } = await convertDocument(token, String(d.id), file);
      setPendingImport({ docId: String(d.id), html });
      openDoc(String(d.id));
    } catch (e) {
      // sem docs orfaos: conversao falhou -> apaga o doc recem-criado
      await deleteDocument(token, String(d.id)).catch(() => {});
      setImportErr(e instanceof Error ? e.message : String(e));
    }
  }

  if (!token) return <Login onToken={setTok} />;
  if (!me) {
    return meErr ? (
      <p className="hint">
        Falha ao carregar usuario.{" "}
        <button onClick={() => window.location.reload()}>Tentar de novo</button>
      </p>
    ) : (
      <p className="hint">Carregando usuario...</p>
    );
  }

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
        <button onClick={() => importInputRef.current?.click()} title="Importar PDF ou DOCX como documento novo">
          Importar doc
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".pdf,.docx"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importDoc(f);
            e.target.value = "";
          }}
        />
        <button onClick={logout}>Sair</button>
      </header>
      {importErr && <p className="err">Falha ao importar: {importErr}</p>}
      <main>
        {docId ? (
          <Editor
            token={token}
            docId={docId}
            me={me}
            onEditorReady={setEditorInst}
            onCanEdit={setCanEdit}
            onCommentActivated={(markId) => {
              setActiveMarkId(markId);
              if (markId) setTab("comments");
            }}
            onNewComment={(markId) => {
              setDraftMarkId(markId);
              setActiveMarkId(markId);
              setTab("comments");
            }}
            importHtml={pendingImport?.docId === docId ? pendingImport.html : null}
            onImportApplied={() => setPendingImport(null)}
          />
        ) : (
          <p className="hint">Abra um doc existente (por id) ou crie um novo.</p>
        )}
        <Sidebar
          token={token}
          docId={docId}
          editor={editorInst}
          me={me}
          canEdit={canEdit}
          tab={tab}
          onTab={setTab}
          activeMarkId={activeMarkId}
          draftMarkId={draftMarkId}
          onDraftDone={() => setDraftMarkId(null)}
          onOpenDoc={openDoc}
        />
      </main>
    </div>
  );
}
