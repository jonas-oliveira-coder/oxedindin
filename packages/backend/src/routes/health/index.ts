import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', async (request, reply) => {
    let dbStatus = 'ok';
    let redisStatus = 'ok';

    try {
      await app.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'down';
    }

    try {
      if (app.redis) {
        await app.redis.ping();
      }
    } catch {
      redisStatus = 'down';
    }

    const status = dbStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
      version: process.env.npm_package_version || '0.0.0',
    };
  });
};

export default healthRoutes;