// Probe headless: mede o handshake Hocuspocus fase a fase (diagnostico dev).
// Uso: docker exec nyx-frontend node /app/probe-ws.mjs [docId]
import { HocuspocusProvider, HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import WebSocket from "ws";
import * as Y from "yjs";

const API = process.env.PROBE_API ?? "http://backend-api:8000";
const WS_URL = process.env.PROBE_WS ?? "ws://realtime-server:1234";
const docId = process.argv[2] ?? "1";

const email = `probe_${Date.now()}@nyx.dev`;
await fetch(`${API}/api/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: "probe-pw-123", role: "engineer_lead" }),
});
const loginRes = await fetch(`${API}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ username: email, password: "probe-pw-123" }),
});
const { access_token: token } = await loginRes.json();

const t0 = Date.now();
const mark = (label) => console.log(`[probe] +${Date.now() - t0}ms ${label}`);
mark("inicio");

const ydoc = new Y.Doc();
const socket = new HocuspocusProviderWebsocket({ url: WS_URL, WebSocketPolyfill: WebSocket });
const provider = new HocuspocusProvider({
  websocketProvider: socket,
  name: String(docId),
  token,
  document: ydoc,
  onStatus: (e) => mark(`status=${e.status}`),
  onAuthenticated: () => mark("authenticated"),
  onAuthenticationFailed: (e) => { mark(`AUTH FAILED: ${JSON.stringify(e)}`); process.exit(1); },
  onSynced: () => {
    mark("synced");
    const text = ydoc.getXmlFragment("default").toString();
    console.log(`[probe] conteudo: ${text.length} chars -> ${text.slice(0, 120)}`);
    provider.destroy();
    socket.destroy();
    process.exit(0);
  },
});

setTimeout(() => { mark("TIMEOUT 30s"); process.exit(2); }, 30000);
