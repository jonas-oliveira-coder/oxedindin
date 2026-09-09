import fp from 'fastify-plugin';
import { db, closePool } from '../db';
import { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    db: typeof db;
  }
}

export default fp(async (app: FastifyInstance) => {
  app.decorate('db', db);

  app.addHook('onClose', async () => {
    await closePool();
  });
});