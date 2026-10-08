import { describe, it, expect, beforeEach } from 'vitest';
import notificationsRoutes from './index.js';
import { buildApp, TEST_USER_ID, uuid } from '../../test/helpers.js';
import { notification } from '../../db/schema/index.js';

describe('notifications routes', () => {
  let app: any;
  let db: any;

  beforeEach(async () => {
    const harness = await buildApp(notificationsRoutes, '/api/v1/notifications');
    app = harness.app;
    db = harness.db;
  });

  it('accepts string boolean in query parameter (e.g. read=false)', async () => {
    db.seed(notification, [
      {
        id: uuid(),
        userId: TEST_USER_ID,
        title: 'Lembrete de Conta',
        message: 'Sua conta vence em 2 dias',
        type: 'BILL_DUE_SOON',
        read: false,
        createdAt: new Date(),
      },
      {
        id: uuid(),
        userId: TEST_USER_ID,
        title: 'Fatura Paga',
        message: 'Pagamento confirmado',
        type: 'INVOICE_PAID',
        read: true,
        createdAt: new Date(),
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications?read=false&limit=1',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].read).toBe(false);
  });

  it('accepts string boolean in query parameter (e.g. read=true)', async () => {
    db.seed(notification, [
      {
        id: uuid(),
        userId: TEST_USER_ID,
        title: 'Fatura Paga',
        message: 'Pagamento confirmado',
        type: 'INVOICE_PAID',
        read: true,
        createdAt: new Date(),
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications?read=true',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].read).toBe(true);
  });

  it('returns all notifications when read parameter is omitted', async () => {
    db.seed(notification, [
      {
        id: uuid(),
        userId: TEST_USER_ID,
        title: 'Nota 1',
        message: 'Msg 1',
        type: 'SYSTEM',
        read: false,
        createdAt: new Date(),
      },
      {
        id: uuid(),
        userId: TEST_USER_ID,
        title: 'Nota 2',
        message: 'Msg 2',
        type: 'SYSTEM',
        read: true,
        createdAt: new Date(),
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
  });
});
