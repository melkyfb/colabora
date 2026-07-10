import { useRef, useState } from "react";

import { login, register } from "./api";

export function Login({ onToken }: { onToken: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  // estado do modal de cadastro
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regRole, setRegRole] = useState("engineer_lead");
  const [regErr, setRegErr] = useState("");

  async function doLogin() {
    setErr("");
    try {
      onToken(await login(email, password));
    } catch (e) {
      setErr(String(e));
    }
  }

  async function doRegister() {
    setRegErr("");
    if (regPassword !== regConfirm) {
      setRegErr("As senhas nao conferem.");
      return;
    }
    try {
      await register(regEmail, regPassword, regRole);
      onToken(await login(regEmail, regPassword));
      dialogRef.current?.close();
    } catch (e) {
      setRegErr(String(e));
    }
  }

  return (
    <div className="card">
      <h1>Nyx Platform</h1>
      <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input
        placeholder="senha"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && doLogin()}
      />
      <div className="row">
        <button onClick={doLogin}>Entrar</button>
        <button className="ghost" onClick={() => dialogRef.current?.showModal()}>
          Criar conta
        </button>
      </div>
      {err && <p className="err">{err}</p>}

      {/* modal nativo de cadastro (F3) */}
      <dialog ref={dialogRef} className="register-modal">
        <h2>Criar conta</h2>
        <input placeholder="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
        <input
          placeholder="senha"
          type="password"
          value={regPassword}
          onChange={(e) => setRegPassword(e.target.value)}
        />
        <input
          placeholder="confirmar senha"
          type="password"
          value={regConfirm}
          onChange={(e) => setRegConfirm(e.target.value)}
        />
        <select
          value={regRole}
          onChange={(e) => setRegRole(e.target.value)}
          title="Papel global do usuario (PoC: auto-atribuido)"
        >
          <option value="engineer_l1">engineer_l1 (le)</option>
          <option value="engineer_lead">engineer_lead (le + escreve)</option>
          <option value="admin">admin</option>
        </select>
        <div className="row">
          <button onClick={doRegister}>Registrar</button>
          <button className="ghost" onClick={() => dialogRef.current?.close()}>
            Cancelar
          </button>
        </div>
        {regErr && <p className="err">{regErr}</p>}
      </dialog>
    </div>
  );
}
