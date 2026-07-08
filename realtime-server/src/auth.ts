import { config } from "./config";

export interface AuthzResult {
  allowed: boolean;
  userId?: string;
  roles?: string[];
}

/**
 * Consulta o FastAPI (que decodifica o JWT e chama o Cerbos) pra autorizar a
 * conexao WS. O realtime-server NAO decodifica JWT nem fala com o Cerbos direto:
 * a logica de auth mora so no FastAPI.
 */
export async function authorizeConnection(
  token: string | undefined,
  documentName: string,
): Promise<AuthzResult> {
  if (!token) return { allowed: false };

  try {
    const res = await fetch(`${config.fastapiInternalUrl}/api/internal/authorize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": config.internalApiKey,
      },
      body: JSON.stringify({ token, documentName }),
    });
    if (res.status !== 200) return { allowed: false };
    return (await res.json()) as AuthzResult;
  } catch (err) {
    console.error("[nyx-hocuspocus] falha ao autorizar no FastAPI:", err);
    return { allowed: false };
  }
}
