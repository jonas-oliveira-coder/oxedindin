import { Redis } from 'ioredis';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

export default fp(async (app) => {
  const redisUrl = app.config.env.REDIS_URL;

  if (!redisUrl) {
    app.log.warn('REDIS_URL not configured, skipping Redis connection');
    return;
  }

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });

  redis.on('error', (err) => {
    app.log.error({ err }, 'Redis connection error');
  });

  redis.on('connect', () => {
    app.log.info('Redis connected');
  });

  await redis.connect();

  app.decorate('redis', redis);

  app.addHook('onClose', async (app) => {
    await app.redis.quit();
  });
});