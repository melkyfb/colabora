// Config via env. Defaults apontam pra localhost (rodar fora do Docker);
// no compose as vars vem apontando pros nomes de servico (redis, backend-api).
export const config = {
  port: Number(process.env.HOCUSPOCUS_PORT ?? 1234),
  redisHost: process.env.REDIS_HOST ?? "localhost",
  redisPort: Number(process.env.REDIS_PORT ?? 6379),
  fastapiInternalUrl: process.env.FASTAPI_INTERNAL_URL ?? "http://localhost:8000",
  webhookUrl:
    process.env.WEBHOOK_URL ?? "http://localhost:8000/api/webhooks/hocuspocus",
  webhookSecret:
    process.env.HOCUSPOCUS_WEBHOOK_SECRET ?? "dev-webhook-secret-change-me",
  internalApiKey:
    process.env.INTERNAL_API_KEY ?? "dev-internal-key-change-me-min-32-bytes",
};
