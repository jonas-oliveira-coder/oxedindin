import { describe, it, expect, beforeEach } from 'vitest';
import cardsRoutes from './index.js';
import { buildApp, TEST_USER_ID, OTHER_USER_ID } from '../../test/helpers.js';
import { creditCard } from '../../db/schema/index.js';

describe('cards routes', () => {
  let app: any;
  let db: any;

  beforeEach(async () => {
    const harness = await buildApp(cardsRoutes, '/api/v1/cards');
    app = harness.app;
    db = harness.db;
  });

  it('creates a card mapping limit to limit cents columns', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cards',
      payload: {
        name: 'Visa Platinum',
        institution: 'Nubank',
        brand: 'VISA',
        last4: '1234',
        limit: 100000,
        closingDay: 5,
        dueDay: 10,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe('Visa Platinum');
    expect(body.limit).toEqual({ cents: 100000, currency: 'BRL' });
    expect(body.availableLimit).toEqual({ cents: 100000, currency: 'BRL' });

    const rows = db.all(creditCard);
    expect(rows).toHaveLength(1);
    expect(rows[0].limitCents).toBe(100000);
    expect(rows[0].availableLimitCents).toBe(100000);
    expect(rows[0].userId).toBe(TEST_USER_ID);
    expect(rows[0]).not.toHaveProperty('limit');
  });

  it('rejects a card with an account owned by another user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cards',
      payload: {
        name: 'Master',
        institution: 'Itaú',
        brand: 'MASTERCARD',
        last4: '5678',
        limit: 50000,
        closingDay: 5,
        dueDay: 10,
        accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('updates a card mapping limit to limit cents columns', async () => {
    db.seed(creditCard, [{
      id: '66666666-6666-4666-8666-666666666666',
      userId: TEST_USER_ID,
      name: 'Elo',
      institution: 'Caixa',
      brand: 'ELO',
      last4: '9999',
      limitCents: 50000,
      availableLimitCents: 50000,
      closingDay: 5,
      dueDay: 10,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/cards/66666666-6666-4666-8666-666666666666',
      payload: { name: 'Elo Renomeado', limit: 80000 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Elo Renomeado');
    expect(res.json().limit).toEqual({ cents: 80000, currency: 'BRL' });

    const rows = db.all(creditCard);
    expect(rows[0].limitCents).toBe(80000);
    expect(rows[0].availableLimitCents).toBe(80000);
    expect(rows[0]).not.toHaveProperty('limit');
  });

  it('returns 404 when getting a card owned by another user', async () => {
    db.seed(creditCard, [{
      id: '77777777-7777-4777-8777-777777777777',
      userId: OTHER_USER_ID,
      name: 'Outro',
      institution: 'Banco',
      brand: 'VISA',
      last4: '1111',
      limitCents: 1000,
      availableLimitCents: 1000,
      closingDay: 5,
      dueDay: 10,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({ method: 'GET', url: '/api/v1/cards/77777777-7777-4777-8777-777777777777' });
    expect(res.statusCode).toBe(404);
  });

  it('deactivates a card on delete', async () => {
    db.seed(creditCard, [{
      id: '88888888-8888-4888-8888-888888888888',
      userId: TEST_USER_ID,
      name: 'Hiper',
      institution: 'Itaú',
      brand: 'HIPERCARD',
      last4: '2222',
      limitCents: 1000,
      availableLimitCents: 1000,
      closingDay: 5,
      dueDay: 10,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({ method: 'DELETE', url: '/api/v1/cards/88888888-8888-4888-8888-888888888888' });
    expect(res.statusCode).toBe(200);
    expect(db.all(creditCard)[0].status).toBe('INACTIVE');
  });
});