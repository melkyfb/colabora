import { authedFetch } from "./auth";
import { API_URL } from "./config";

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  // OAuth2 password form: campo "username" = email
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Login falhou (credenciais invalidas?)");
  const data = await res.json();
  return { accessToken: data.access_token as string, refreshToken: data.refresh_token as string };
}

export async function register(email: string, password: string, role: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, role }),
  });
  if (!res.ok && res.status !== 409) throw new Error("Registro falhou");
}

export interface DocumentOut {
  id: number;
  title: string;
  owner_id: number;
  updated_at: string;
  can_edit: boolean;
}

export async function createDocument(token: string, title: string): Promise<DocumentOut> {
  const res = await authedFetch("/api/documents", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Criar documento falhou");
  return res.json();
}

export async function getDocument(token: string, id: string): Promise<DocumentOut> {
  const res = await authedFetch(`/api/documents/${id}`, token);
  if (!res.ok) throw new Error("Buscar documento falhou");
  return res.json();
}

export async function updateDocument(
  token: string,
  id: string,
  patch: { title?: string; content?: string },
): Promise<DocumentOut> {
  const res = await authedFetch(`/api/documents/${id}`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Atualizar documento falhou");
  return res.json();
}

export interface ChatSource {
  documentId: string;
  title: string | null;
  chunkIndex: number | null;
  score: number;
  text: string;
}
export interface ChatDocument {
  id: number;
  title: string;
  updatedAt: string;
}
export interface ChatReply {
  answer: string;
  sources: ChatSource[];
  documents: ChatDocument[];
}

export async function ragChat(token: string, query: string): Promise<ChatReply> {
  const res = await authedFetch("/api/rag/chat", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, k: 5 }),
  });
  if (!res.ok) throw new Error("Chat falhou");
  return res.json();
}

export interface MeOut {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
}

export async function fetchMe(token: string): Promise<MeOut> {
  const res = await authedFetch("/api/auth/me", token);
  if (!res.ok) throw new Error("Buscar usuario falhou");
  return res.json();
}

export interface CommentOut {
  id: number;
  document_id: number;
  mark_id: string;
  author_id: number;
  author_name: string;
  parent_id: number | null;
  body: string;
  resolved: boolean;
  created_at: string;
  updated_at: string;
}

export async function listComments(token: string, docId: string): Promise<CommentOut[]> {
  const res = await authedFetch(`/api/documents/${docId}/comments`, token);
  if (!res.ok) throw new Error("Listar comentarios falhou");
  return res.json();
}

export async function createComment(
  token: string,
  docId: string,
  payload: { mark_id: string; body: string; parent_id?: number },
): Promise<CommentOut> {
  const res = await authedFetch(`/api/documents/${docId}/comments`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Criar comentario falhou");
  return res.json();
}

export async function updateComment(
  token: string,
  commentId: number,
  patch: { body?: string; resolved?: boolean },
): Promise<CommentOut> {
  const res = await authedFetch(`/api/comments/${commentId}`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Atualizar comentario falhou");
  return res.json();
}

export async function deleteComment(token: string, commentId: number): Promise<void> {
  const res = await authedFetch(`/api/comments/${commentId}`, token, { method: "DELETE" });
  if (!res.ok) throw new Error("Apagar comentario falhou");
}

export async function convertDocument(
  token: string,
  docId: string,
  file: File,
): Promise<{ html: string }> {
  const form = new FormData();
  form.append("file", file);
  // sem Content-Type manual: o browser define o boundary do multipart
  const res = await authedFetch(`/api/documents/${docId}/convert`, token, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    let detail = "Conversao falhou";
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      // corpo nao-JSON: mantem a mensagem generica
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function deleteDocument(token: string, id: string): Promise<void> {
  const res = await authedFetch(`/api/documents/${id}`, token, { method: "DELETE" });
  if (!res.ok) throw new Error("Apagar documento falhou");
}
