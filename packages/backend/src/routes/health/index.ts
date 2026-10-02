import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { sql } from 'drizzle-orm';

const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', async (request: any, reply: any) => {
    let dbStatus: 'ok' | 'down' = 'ok';

    try {
      await app.db.execute(sql`SELECT 1`);
    } catch {
      dbStatus = 'down';
    }

    const status = dbStatus === 'ok' ? 'ok' : 'down';

    return {
      status,
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
      },
      version: process.env.npm_package_version || '0.0.0',
    };
  });
};

export default healthRoutes;