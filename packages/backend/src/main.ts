import Fastify from 'fastify';
import autoload from '@fastify/autoload';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatorCompiler } from 'fastify-type-provider-zod';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './db/index.js';
import { env } from './utils/env.js';

// JSON.stringify cannot serialize BigInt by default. Database money columns
// are mapped to BigInt by Drizzle; patch toJSON so responses serialize safely.
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const app = Fastify({
  logger: {
    transport: env.NODE_ENV !== 'production' ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    } : undefined,
    level: env.LOG_LEVEL || 'info',
  },
  ajv: {
    customOptions: {
      coerceTypes: 'array',
      removeAdditional: 'all',
    },
  },
});

app.setValidatorCompiler(validatorCompiler);

// Store env in app for access in plugins
(app as any).config = { env };

await app.register((await import('@fastify/helmet')).default, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
  noSniff: true,
  frameguard: { action: 'deny' },
});

await app.register((await import('@fastify/cors')).default, {
  origin: env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
});

await app.register((await import('@fastify/cookie')).default, {
  secret: env.COOKIE_SECRET,
  hook: 'onRequest',
  parseOptions: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  },
});

await app.register((await import('@fastify/csrf-protection')).default, {
  cookieOpts: {
    path: '/',
    sameSite: 'strict',
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
  },
});

// Enforce CSRF on unsafe methods, skipping safe methods and public endpoints
// that must not require a token (health/docs swagger).
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
app.addHook('preValidation', async (request: any, reply: any) => {
  if (SAFE_METHODS.has(request.method)) return;
  if (request.url === '/health' || request.url?.startsWith('/docs')) return;
  await new Promise<void>((resolve, reject) => {
    app.csrfProtection(request, reply, (err?: Error) => (err ? reject(err) : resolve()));
  });
});

await app.register((await import('@fastify/rate-limit')).default, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.ip,
  skipOnError: true,
  hook: 'onRequest',
});

await app.register((await import('@fastify/jwt')).default, {
  secret: env.JWT_SECRET,
  sign: {
    expiresIn: '15m',
  },
  cookie: {
    cookieName: 'accessToken',
    signed: false,
  },
});

await app.register((await import('@fastify/sensible')).default);

await app.register((await import('@fastify/swagger')).default, {
  openapi: {
    info: {
      title: 'OxeDinDin API',
      description: 'API do gerenciador financeiro pessoal OxeDinDin',
      version: '1.0.0',
    },
    servers: [
      { url: env.API_URL || 'http://localhost:3000', description: 'Development server' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'accessToken',
        },
      },
    },
    security: [{ bearerAuth: [], cookieAuth: [] }],
  },
});

await app.register((await import('@fastify/swagger-ui')).default, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
  },
  staticCSP: true,
});

await app.register((await import('@fastify/websocket')).default);

// Register plugins first (prisma, redis, auth, audit, websocket)
await app.register(autoload, {
  dir: join(__dirname, 'plugins'),
  options: { prefix: '' },
});

// Register routes
await app.register(autoload, {
  dir: join(__dirname, 'routes'),
  options: { prefix: '/api/v1' },
});

app.get('/health', async () => {
  let database: 'ok' | 'down' = 'ok';
  let redis: 'ok' | 'down' = 'ok';

  try {
    await app.db.execute(sql`SELECT 1`);
  } catch {
    database = 'down';
  }

  if (!app.redis) {
    redis = 'down';
  } else {
    try {
      await app.redis.ping();
    } catch {
      redis = 'down';
    }
  }

  const status = database === 'ok' && redis === 'ok' ? 'ok' : database === 'down' ? 'down' : 'degraded';

  return {
    status,
    timestamp: new Date().toISOString(),
    services: { database, redis },
    version: process.env.npm_package_version || '0.0.0',
  };
});

const STATUS_CODE_MAP: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
  500: 'INTERNAL',
};

function mapValidationFields(error: any): Record<string, string> | undefined {
  const issues = error?.issues;
  if (!Array.isArray(issues)) return undefined;

  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = Array.isArray(issue?.path) && issue.path.length > 0 ? issue.path.join('.') : 'body';
    if (!fields[key]) {
      fields[key] = typeof issue?.message === 'string' ? issue.message : 'Valor inválido.';
    }
  }
  return Object.keys(fields).length > 0 ? fields : undefined;
}

app.setErrorHandler(async (error: any, request, reply) => {
  request.log.error(error);

  const isValidation = error?.code === 'FST_ERR_VALIDATION' || error?.validationContext;
  if (isValidation) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Existem dados inválidos.',
        ...(mapValidationFields(error) ? { fields: mapValidationFields(error) } : {}),
      },
    });
  }

  const statusCode = error?.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
  const code = STATUS_CODE_MAP[statusCode] || 'INTERNAL';

  let message = error?.message || 'Erro interno do servidor.';
  if (statusCode === 429) message = 'Muitas requisições. Tente novamente mais tarde.';
  if (statusCode === 500 && env.NODE_ENV === 'production') message = 'Erro interno do servidor.';

  return reply.status(statusCode).send({
    error: { code, message },
  });
});

try {
  await migrate(db, { migrationsFolder: join(__dirname, '../drizzle') });
  app.log.info('Database migrations completed');
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(`Server listening on ${env.API_URL || `http://localhost:${env.PORT}`}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

export { app };