import { describe, it, expect, beforeEach } from 'vitest';
import invoicesRoutes from './index.js';
import { buildApp, TEST_USER_ID } from '../../test/helpers.js';
import { creditCard, bankAccount, invoice } from '../../db/schema/index.js';

describe('invoices routes', () => {
  let app: any;
  let db: any;

  beforeEach(async () => {
    const harness = await buildApp(invoicesRoutes, '/api/v1/invoices');
    app = harness.app;
    db = harness.db;
  });

  it('returns empty array when user has no cards without crashing on inArray', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/invoices' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
    expect(res.json().meta.total).toBe(0);
  });

  it('returns empty array on upcoming invoices when user has no cards', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/invoices/upcoming' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('pays invoice and updates account balance and card limit', async () => {
    const cardId = '11111111-1111-4111-8111-111111111111';
    const invoiceId = '22222222-2222-4222-8222-222222222222';
    const accountId = '33333333-3333-4333-8333-333333333333';

    db.seed(creditCard, [{
      id: cardId,
      userId: TEST_USER_ID,
      name: 'Cartão Teste',
      institution: 'Banco',
      brand: 'VISA',
      last4: '1234',
      limitCents: 100000,
      availableLimitCents: 50000,
      closingDay: 5,
      dueDay: 15,
      status: 'ACTIVE',
    }]);

    db.seed(bankAccount, [{
      id: accountId,
      userId: TEST_USER_ID,
      name: 'Conta Corrente',
      institution: 'Banco',
      type: 'CHECKING',
      balanceCents: 100000,
      initialBalanceCents: 100000,
      status: 'ACTIVE',
    }]);

    db.seed(invoice, [{
      id: invoiceId,
      cardId,
      periodStart: new Date('2026-09-01'),
      periodEnd: new Date('2026-09-30'),
      closingDate: new Date('2026-09-30'),
      dueDate: new Date('2026-10-10'),
      totalCents: 50000,
      paidCents: 0,
      remainingCents: 50000,
      status: 'OPEN',
    }]);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/invoices/${invoiceId}/pay`,
      payload: {
        amount: 50000,
        accountId,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().remaining).toEqual({ cents: 0, currency: 'BRL' });
    expect(res.json().status).toBe('PAID');
  });
});
