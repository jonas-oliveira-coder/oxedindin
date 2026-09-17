import { describe, it, expect, beforeEach } from 'vitest';
import sharedDebtsRoutes from './index.js';
import { buildApp, TEST_USER_ID, OTHER_USER_ID } from '../../test/helpers.js';
import { sharedDebt, debt, sharedDebtPayment, sharedDebtEvent, notification, user } from '../../db/schema/index.js';

const CREDITOR_ID = '00000000-0000-4000-8000-000000000003';
const DEBT_ID = 'aaaa1111-1111-4111-8111-111111111111';
const SHARED_ID = 'bbbb2222-2222-4222-8222-222222222222';
const PAYMENT_ID = 'cccc3333-3333-4333-8333-333333333333';

function seedUsers(db: any) {
  db.seed(user, [
    { id: TEST_USER_ID, email: 'debtor@example.com', name: 'Devedor', createdAt: new Date(), updatedAt: new Date() },
    { id: CREDITOR_ID, email: 'creditor@example.com', name: 'Credor', createdAt: new Date(), updatedAt: new Date() },
  ]);
}

function seedDebt(db: any, opts: { paid?: number; total?: number } = {}) {
  db.seed(debt, [{
    id: DEBT_ID,
    userId: CREDITOR_ID,
    description: 'Conta do restaurante',
    totalAmountCents: opts.total ?? 10000,
    paidAmountCents: opts.paid ?? 0,
    remainingAmountCents: (opts.total ?? 10000) - (opts.paid ?? 0),
    dueDate: new Date(),
    type: 'PURCHASE',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  }]);
}

function seedShared(db: any, status: string, amountCents = 5000) {
  db.seed(sharedDebt, [{
    id: SHARED_ID,
    debtId: DEBT_ID,
    debtorUserId: TEST_USER_ID,
    creditorUserId: CREDITOR_ID,
    status,
    amountCents,
    notifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }]);
}

describe('shared-debts routes', () => {
  let app: any;
  let db: any;

  beforeEach(async () => {
    const harness = await buildApp(sharedDebtsRoutes, '/api/v1/shared-debts');
    app = harness.app;
    db = harness.db;
    seedUsers(db);
  });

  it('debtor accepts a pending shared debt', async () => {
    seedDebt(db);
    seedShared(db, 'PENDING');

    const res = await app.inject({ method: 'POST', url: `/api/v1/shared-debts/${SHARED_ID}/accept` });
    expect(res.statusCode).toBe(200);
    expect(db.all(sharedDebt)[0].status).toBe('ACCEPTED');
    expect(db.all(sharedDebtEvent)).toHaveLength(1);
    expect(db.all(sharedDebtEvent)[0].type).toBe('ACCEPTED');
    expect(db.all(notification)).toHaveLength(1);
    expect(db.all(notification)[0].userId).toBe(CREDITOR_ID);
  });

  it('creditor cannot accept a shared debt (403)', async () => {
    seedDebt(db);
    // TEST_USER is the creditor, OTHER_USER is the debtor
    db.seed(sharedDebt, [{
      id: SHARED_ID,
      debtId: DEBT_ID,
      debtorUserId: OTHER_USER_ID,
      creditorUserId: TEST_USER_ID,
      status: 'PENDING',
      amountCents: 5000,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({ method: 'POST', url: `/api/v1/shared-debts/${SHARED_ID}/accept` });
    expect(res.statusCode).toBe(403);
  });

  it('cannot accept an already rejected shared debt (409)', async () => {
    seedDebt(db);
    seedShared(db, 'REJECTED');

    const res = await app.inject({ method: 'POST', url: `/api/v1/shared-debts/${SHARED_ID}/accept` });
    expect(res.statusCode).toBe(409);
  });

  it('debtor rejects a pending shared debt', async () => {
    seedDebt(db);
    seedShared(db, 'PENDING');

    const res = await app.inject({ method: 'POST', url: `/api/v1/shared-debts/${SHARED_ID}/reject` });
    expect(res.statusCode).toBe(200);
    expect(db.all(sharedDebt)[0].status).toBe('REJECTED');
    expect(db.all(sharedDebtEvent)[0].type).toBe('REJECTED');
    expect(db.all(notification)[0].userId).toBe(CREDITOR_ID);
  });

  it('debtor reports a payment on an accepted debt', async () => {
    seedDebt(db);
    seedShared(db, 'ACCEPTED', 5000);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/shared-debts/${SHARED_ID}/pay`,
      payload: { amount: 4000, method: 'PIX', notes: 'paguei hoje' },
    });
    expect(res.statusCode).toBe(200);
    expect(db.all(sharedDebt)[0].status).toBe('PAYMENT_REPORTED');
    const payment = db.all(sharedDebtPayment)[0];
    expect(payment.status).toBe('REPORTED');
    expect(Number(payment.amountCents)).toBe(4000);
    expect(payment.method).toBe('PIX');
    expect(db.all(sharedDebtEvent).some((e: any) => e.type === 'PAYMENT_REPORTED')).toBe(true);
    expect(db.all(notification)[0].userId).toBe(CREDITOR_ID);
  });

  it('rejects a payment exceeding the debtor portion (400)', async () => {
    seedDebt(db);
    seedShared(db, 'ACCEPTED', 5000);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/shared-debts/${SHARED_ID}/pay`,
      payload: { amount: 6000 },
    });
    expect(res.statusCode).toBe(400);
    expect(db.all(sharedDebtPayment)).toHaveLength(0);
  });

  it('creditor confirms a reported payment and updates the debt', async () => {
    seedDebt(db, { total: 10000, paid: 0 });
    db.seed(sharedDebt, [{
      id: SHARED_ID,
      debtId: DEBT_ID,
      debtorUserId: OTHER_USER_ID,
      creditorUserId: TEST_USER_ID,
      status: 'PAYMENT_REPORTED',
      amountCents: 4000,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
    db.seed(sharedDebtPayment, [{
      id: PAYMENT_ID,
      sharedDebtId: SHARED_ID,
      amountCents: 4000,
      paymentDate: new Date(),
      method: 'PIX',
      reportedByUserId: OTHER_USER_ID,
      status: 'REPORTED',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/shared-debts/${SHARED_ID}/payments/${PAYMENT_ID}/confirm`,
    });
    expect(res.statusCode).toBe(200);
    expect(db.all(sharedDebtPayment)[0].status).toBe('CONFIRMED');
    expect(db.all(sharedDebt)[0].status).toBe('PAYMENT_CONFIRMED');
    expect(Number(db.all(debt)[0].paidAmountCents)).toBe(4000);
    expect(Number(db.all(debt)[0].remainingAmountCents)).toBe(6000);
  });

  it('creditor disputes a reported payment', async () => {
    seedDebt(db);
    db.seed(sharedDebt, [{
      id: SHARED_ID,
      debtId: DEBT_ID,
      debtorUserId: OTHER_USER_ID,
      creditorUserId: TEST_USER_ID,
      status: 'PAYMENT_REPORTED',
      amountCents: 4000,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
    db.seed(sharedDebtPayment, [{
      id: PAYMENT_ID,
      sharedDebtId: SHARED_ID,
      amountCents: 4000,
      paymentDate: new Date(),
      reportedByUserId: OTHER_USER_ID,
      status: 'REPORTED',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/shared-debts/${SHARED_ID}/payments/${PAYMENT_ID}/dispute`,
    });
    expect(res.statusCode).toBe(200);
    expect(db.all(sharedDebtPayment)[0].status).toBe('DISPUTED');
    expect(db.all(sharedDebt)[0].status).toBe('PAYMENT_VERIFYING');
    expect(Number(db.all(debt)[0].paidAmountCents)).toBe(0);
  });

  it('debtor cannot confirm a payment (403)', async () => {
    seedDebt(db);
    seedShared(db, 'PAYMENT_REPORTED');
    db.seed(sharedDebtPayment, [{
      id: PAYMENT_ID,
      sharedDebtId: SHARED_ID,
      amountCents: 4000,
      paymentDate: new Date(),
      reportedByUserId: TEST_USER_ID,
      status: 'REPORTED',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/shared-debts/${SHARED_ID}/payments/${PAYMENT_ID}/confirm`,
    });
    expect(res.statusCode).toBe(403);
  });
});