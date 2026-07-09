import { Redis } from "@hocuspocus/extension-redis";
import { Events, Webhook } from "@hocuspocus/extension-webhook";
import { Hocuspocus } from "@hocuspocus/server";
import { TiptapTransformer } from "@hocuspocus/transformer";

import { authorizeConnection } from "./auth";
import { config } from "./config";

const server = new Hocuspocus({
  name: "nyx-hocuspocus",
  port: config.port,

  extensions: [
    // Escala horizontal: sincroniza o estado CRDT entre instancias via Redis pub/sub.
    new Redis({ host: config.redisHost, port: config.redisPort }),

    // Persistencia: ao mudar (debounce interno), POST assinado (HMAC-SHA256) pro
    // FastAPI, que grava o estado final no MySQL (/api/webhooks/hocuspocus).
    new Webhook({
      url: config.webhookUrl,
      secret: config.webhookSecret,
      // ponytail: transformer padrao gera JSON generico. Na Fase 5, configurar
      // TiptapTransformer com as MESMAS extensions do editor p/ fidelidade total.
      transformer: TiptapTransformer,
      events: [Events.onChange],
    }),
  ],

  // Gatekeeper da Via Expressa: consulta FastAPI (JWT + Cerbos) ANTES de aceitar o WS.
  // Lancar erro aqui recusa a conexao.
  async onAuthenticate(data) {
    const result = await authorizeConnection(data.token, data.documentName);
    if (!result.allowed) {
      throw new Error("Conexao nao autorizada");
    }
    console.log(
      `[nyx-hocuspocus] conexao autorizada: doc=${data.documentName} user=${result.userId} roles=${result.roles?.join(",")}`,
    );
    // Contexto disponivel nos hooks/extensions seguintes.
    return { userId: result.userId, roles: result.roles };
  },
});

server.listen().then(() => {
  console.log(`[nyx-hocuspocus] WS ouvindo na porta ${config.port}`);
});
