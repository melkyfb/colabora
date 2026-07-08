// URLs vistas pelo BROWSER (roda no host), entao apontam pras portas expostas
// dos containers, nao pros nomes de servico do compose.
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:1234";
