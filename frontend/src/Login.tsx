import { useState } from "react";

import { login, register } from "./api";

export function Login({ onToken }: { onToken: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("engineer_lead");
  const [err, setErr] = useState("");

  async function doLogin() {
    setErr("");
    try {
      onToken(await login(email, password));
    } catch (e) {
      setErr(String(e));
    }
  }

  async function doRegister() {
    setErr("");
    try {
      await register(email, password, role);
      onToken(await login(email, password));
    } catch (e) {
      setErr(String(e));
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
      />
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="engineer_l1">engineer_l1 (le)</option>
        <option value="engineer_lead">engineer_lead (le + escreve)</option>
        <option value="admin">admin</option>
      </select>
      <div className="row">
        <button onClick={doLogin}>Entrar</button>
        <button onClick={doRegister}>Registrar + Entrar</button>
      </div>
      {err && <p className="err">{err}</p>}
    </div>
  );
}
