import 'fastify';
import { User, Session } from '../db/schema/tables';

declare module 'fastify' {
  interface FastifyInstance {
    config: {
      env: {
        NODE_ENV: string;
        PORT: number;
        LOG_LEVEL: string;
        DATABASE_URL: string;
        REDIS_URL?: string;
        JWT_SECRET: string;
        JWT_REFRESH_SECRET: string;
        COOKIE_SECRET: string;
        CORS_ORIGIN: string;
        API_URL?: string;
        WEB_AUTHN_RP_ID: string;
        WEB_AUTHN_RP_NAME: string;
        WEB_AUTHN_ORIGIN: string;
        EMAIL_HOST?: string;
        EMAIL_PORT?: number;
        EMAIL_USER?: string;
        EMAIL_PASS?: string;
        EMAIL_FROM?: string;
        FRONTEND_URL: string;
      };
    };
    db: import('../db').DB;
    authService: import('../services/auth.service').AuthService;
    auditLog: (input: {
      userId: string;
      action: string;
      entityType: string;
      entityId: string;
      oldData?: Record<string, unknown>;
      newData?: Record<string, unknown>;
      ip?: string;
      userAgent?: string;
    }) => Promise<void>;
    broadcast: (userId: string, message: unknown) => void;
    broadcastToAll: (message: unknown) => void;
    wsClients: Map<string, {
      userId: string;
      ws: import('ws').WebSocket;
      subscriptions: Set<string>;
    }>;
    authenticate: (request: any, reply: any) => Promise<void>;
  }

  interface FastifyRequest {
    authUser?: (User & { session?: Session }) | null;
    body: any;
    params: any;
    query: any;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; sessionId: string; type?: string };
  }
}