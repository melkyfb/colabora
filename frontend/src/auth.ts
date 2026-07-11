import { API_URL } from "./config";

const ACCESS_KEY = "nyx_token";
const REFRESH_KEY = "nyx_refresh";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// le o "exp" (ms desde epoch) de um JWT sem validar assinatura -- so p/ agendar refresh.
export function tokenExpiryMs(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

let onTokenRefreshed: ((access: string) => void) | null = null;
let onLogout: (() => void) | null = null;

export function registerAuthHandlers(handlers: {
  onTokenRefreshed: (access: string) => void;
  onLogout: () => void;
}): void {
  onTokenRefreshed = handlers.onTokenRefreshed;
  onLogout = handlers.onLogout;
}

export function handleAuthFailure(): void {
  clearTokens();
  onLogout?.();
}

// evita disparar N refreshes concorrentes quando varias chamadas tomam 401 juntas
let refreshInFlight: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return data.access_token as string;
}

export function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// fetch autenticado com 1 retry automatico via refresh token em caso de 401.
// Em falha de refresh (refresh token tambem vencido/invalido), forca logout.
export async function authedFetch(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  const withAuth = (t: string): RequestInit => ({
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${t}` },
  });

  let res = await fetch(`${API_URL}${path}`, withAuth(token));
  if (res.status !== 401) return res;

  const newAccess = await refreshAccessToken();
  if (!newAccess) {
    handleAuthFailure();
    return res;
  }
  onTokenRefreshed?.(newAccess);
  res = await fetch(`${API_URL}${path}`, withAuth(newAccess));
  if (res.status === 401) handleAuthFailure();
  return res;
}
