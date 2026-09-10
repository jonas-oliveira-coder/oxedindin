import fp from 'fastify-plugin';
import { AuthService } from '../services/index.js';
import { db } from '../db/index.js';

interface AuditLogInput {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    authService: AuthService;
    db: typeof db;
    auditLog: (input: AuditLogInput) => Promise<void>;
    broadcast: (userId: string, message: unknown) => void;
    broadcastToAll: (message: unknown) => void;
    wsClients: Map<string, any>;
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}

export default fp(async (app) => {
  const authService = new AuthService(app);
  app.decorate('authService', authService);
});