import type { ConnectionOptions } from 'bullmq';

/** Converte `redis://usuario:senha@host:porta/db` nas opções de conexão do BullMQ. */
export function redisConnectionOptions(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  const db = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0;
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: Number.isInteger(db) ? db : 0,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    // Exigido pelo BullMQ para os workers esperarem o Redis voltar em vez de falhar.
    maxRetriesPerRequest: null,
  };
}
