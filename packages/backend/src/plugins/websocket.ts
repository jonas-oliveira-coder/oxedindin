import fp from 'fastify-plugin';
import { WebSocket } from 'ws';
import { user, session } from '../db/schema/tables.js';
import { eq } from 'drizzle-orm';

interface ConnectedClient {
  userId: string;
  ws: WebSocket;
  subscriptions: Set<string>;
}

declare module 'fastify' {
  interface FastifyInstance {
    wsClients: Map<string, any>;
    broadcast: (userId: string, message: unknown) => void;
    broadcastToAll: (message: unknown) => void;
  }
}

export default fp(async (app) => {
  const clients = new Map<string, ConnectedClient>();

  app.decorate('wsClients', clients);

  app.decorate('broadcast', (userId: string, message: unknown) => {
    const client = clients.get(userId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  });

  app.decorate('broadcastToAll', (message: unknown) => {
    for (const client of clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    }
  });

  app.register(async (fastify) => {
    fastify.get('/ws', { websocket: true }, (connection, request) => {
      const ws = connection.socket;
      let currentUserId: string | null = null;

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'auth') {
            const token = message.token;

            if (!token) {
              ws.send(JSON.stringify({ type: 'error', message: 'Token required' }));
              ws.close(4001, 'Token required');
              return;
            }

            try {
              // @ts-ignore - jwtVerify accepts token string at runtime
              const decoded = await request.jwtVerify<{ sub: string; sessionId: string }>(token);
              const sessionRecord = await app.db.select({
                session: session,
                user: user,
              })
                .from(session)
                .innerJoin(user, eq(session.userId, user.id))
                .where(eq(session.id, decoded.sessionId))
                .limit(1);

              const row = sessionRecord[0];

              if (!row || row.session.revokedAt || row.session.expiresAt < new Date()) {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid session' }));
                ws.close(4001, 'Invalid session');
                return;
              }

              currentUserId = row.user.id;

              const existingClient = clients.get(currentUserId);
              if (existingClient) {
                existingClient.ws.close(4000, 'New connection');
              }

              clients.set(currentUserId, {
                userId: currentUserId,
                ws,
                subscriptions: new Set(),
              });

              ws.send(JSON.stringify({ type: 'auth_success', userId: currentUserId }));
              app.log.info({ userId: currentUserId }, 'WebSocket authenticated');
            } catch (err) {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
              ws.close(4001, 'Invalid token');
            }
          } else if (message.type === 'subscribe' && currentUserId) {
            const client = clients.get(currentUserId);
            if (client) {
              for (const channel of message.channels) {
                client.subscriptions.add(channel);
              }
              ws.send(JSON.stringify({ type: 'subscribed', channels: message.channels }));
            }
          } else if (message.type === 'unsubscribe' && currentUserId) {
            const client = clients.get(currentUserId);
            if (client) {
              for (const channel of message.channels) {
                client.subscriptions.delete(channel);
              }
              ws.send(JSON.stringify({ type: 'unsubscribed', channels: message.channels }));
            }
          } else if (message.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (err) {
          app.log.error({ err }, 'WebSocket message error');
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        if (currentUserId) {
          clients.delete(currentUserId);
          app.log.info({ userId: currentUserId }, 'WebSocket disconnected');
        }
      });

      ws.on('error', (err) => {
        app.log.error({ err, userId: currentUserId }, 'WebSocket error');
      });
    });
  });
});