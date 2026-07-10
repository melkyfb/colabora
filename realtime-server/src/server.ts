import { Redis } from "@hocuspocus/extension-redis";
import { Events, Webhook } from "@hocuspocus/extension-webhook";
import { Hocuspocus } from "@hocuspocus/server";
import { TiptapTransformer } from "@hocuspocus/transformer";
import axios from "axios";
import { createHmac } from "crypto";
import * as Y from "yjs";

import { authorizeConnection } from "./auth";
import { config } from "./config";

function sign(body: Buffer): string {
  return "sha256=" + createHmac("sha256", config.webhookSecret).update(body).digest("hex");
}

const server = new Hocuspocus({
  name: "nyx-hocuspocus",
  port: config.port,

  extensions: [
    // Escala horizontal: sincroniza estado CRDT entre instancias via Redis pub/sub.
    new Redis({ host: config.redisHost, port: config.redisPort }),

    // roadmap: extension-webhook -> FastAPI. onChange notifica o snapshot de texto
    // (TiptapTransformer -> JSON) pro /api/webhooks/hocuspocus.
    new Webhook({
      url: config.webhookUrl,
      secret: config.webhookSecret,
      transformer: TiptapTransformer,
      events: [Events.onChange],
    }),
  ],

  // timing: mede cada etapa do handshake (diagnostico de conexao lenta)
  async onConnect(data) {
    console.log(`[timing] onConnect doc=${data.documentName} t=${Date.now()}`);
  },

  // 1. GATEKEEPER — valida JWT + Cerbos no FastAPI ANTES de aceitar a conexao WS.
  async onAuthenticate(data) {
    const t0 = Date.now();
    const result = await authorizeConnection(data.token, data.documentName);
    if (!result.allowed) {
      throw new Error("Conexao nao autorizada");
    }
    console.log(
      `[timing] onAuthenticate doc=${data.documentName} user=${result.userId} ${Date.now() - t0}ms`,
    );
    // Repassa o token pro contexto (usado em onLoadDocument p/ provar identidade).
    return { token: data.token, userId: result.userId, roles: result.roles };
  },

  // 2. HIDRATACAO — carrega o estado binario Y.js do MySQL (via FastAPI) no load.
  // Fallback: sem binario mas com `content` (ex.: docs do bulk_ingest) -> semeia o
  // Y.Doc a partir do texto puro (paragrafos), tornando txt ingeridos editaveis.
  async onLoadDocument(data) {
    const t0 = Date.now();
    const token = (data.context as { token?: string }).token;
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const response = await axios.get(
        `${config.fastapiInternalUrl}/api/documents/${data.documentName}/state`,
        { headers, responseType: "arraybuffer" },
      );
      const buf = response.data as ArrayBuffer;
      if (buf && buf.byteLength > 0) {
        const ydoc = new Y.Doc();
        Y.applyUpdate(ydoc, new Uint8Array(buf));
        console.log(
          `[timing] onLoadDocument doc=${data.documentName} binario ${buf.byteLength}b ${Date.now() - t0}ms`,
        );
        return ydoc;
      }

      // sem binario: tenta o texto salvo (Document.content)
      const meta = await axios.get(
        `${config.fastapiInternalUrl}/api/documents/${data.documentName}`,
        { headers },
      );
      const content: string | null = meta.data?.content ?? null;
      if (content && content.trim()) {
        const tiptapJson = {
          type: "doc",
          content: content.split(/\r?\n/).map((line) => ({
            type: "paragraph",
            ...(line.length ? { content: [{ type: "text", text: line }] } : {}),
          })),
        };
        // "default" = field usado pela extensao Collaboration do Tiptap
        const ydoc = TiptapTransformer.toYdoc(tiptapJson, "default");
        console.log(
          `[timing] onLoadDocument doc=${data.documentName} semeado do content (${content.length} chars) ${Date.now() - t0}ms`,
        );
        return ydoc;
      }

      console.log(`[timing] onLoadDocument doc=${data.documentName} novo/vazio ${Date.now() - t0}ms`);
      return new Y.Doc();
    } catch (error) {
      console.error(`[nyx-hocuspocus] erro ao carregar doc:`, (error as Error).message);
      throw new Error("Falha ao carregar estado do documento no MySQL.");
    }
  },

  // 3. PERSISTENCIA — ao parar de editar (debounce interno ~2s), grava o estado
  // binario Y.js no MySQL (via FastAPI, assinado com HMAC). Isto e o "salvar
  // quando a edicao parar" do roadmap.
  async onStoreDocument(data) {
    const update = Buffer.from(Y.encodeStateAsUpdate(data.document));
    try {
      await axios.post(`${config.webhookUrl}/state`, update, {
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Hocuspocus-Signature-256": sign(update),
          "X-Document-Name": String(data.documentName),
        },
      });
      console.log(`[nyx-hocuspocus] doc=${data.documentName} persistido (${update.byteLength}b).`);
    } catch (error) {
      console.error(`[nyx-hocuspocus] erro ao persistir doc:`, (error as Error).message);
    }
  },
});

server.listen().then(() => {
  console.log(`[nyx-hocuspocus] WS ouvindo na porta ${config.port}`);
});
