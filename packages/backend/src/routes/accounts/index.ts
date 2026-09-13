import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq, and, gte, lte, desc, count } from 'drizzle-orm';
import { createAccountSchema, updateAccountSchema, paginationSchema, dateRangeSchema } from '../../types/schemas.js';
import { bankAccount, transaction, category, creditCard, bill, recurringBill } from '../../db/schema/index.js';

const accountsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    schema: {
      querystring: paginationSchema.merge(dateRangeSchema),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { page, limit, startDate, endDate } = request.query;
    const userId = request.authUser!.id;

    const conditions = [eq(bankAccount.userId, userId)];
    if (startDate) conditions.push(gte(bankAccount.createdAt, new Date(startDate)));
    if (endDate) conditions.push(lte(bankAccount.createdAt, new Date(endDate)));

    const [accounts, totalResult] = await Promise.all([
      app.db.select().from(bankAccount)
        .where(and(...conditions))
        .orderBy(desc(bankAccount.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      app.db.select({ count: count() }).from(bankAccount).where(and(...conditions)),
    ]);

    const total = totalResult[0]?.count || 0;

    return {
      data: accounts.map((a) => ({
        ...a,
        balance: { cents: Number(a.balanceCents), currency: 'BRL' as const },
        initialBalance: { cents: Number(a.initialBalanceCents), currency: 'BRL' as const },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.post('/', {
    schema: createAccountSchema,
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { initialBalance, ...rest } = request.body;
    const [account] = await app.db.insert(bankAccount).values({
      ...rest,
      userId: request.authUser!.id,
      initialBalanceCents: initialBalance,
      balanceCents: initialBalance,
    }).returning();

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'ACCOUNT_CREATED',
      entityType: 'BankAccount',
      entityId: account.id,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({
      ...account,
      balance: { cents: Number(account.balanceCents), currency: 'BRL' as const },
      initialBalance: { cents: Number(account.initialBalanceCents), currency: 'BRL' as const },
    });
  });

  app.get('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [account] = await app.db.select()
      .from(bankAccount)
      .where(and(eq(bankAccount.id, request.params.id), eq(bankAccount.userId, request.authUser!.id)))
      .limit(1);

    if (!account) {
      throw app.httpErrors.notFound('Account not found');
    }

    return {
      ...account,
      balance: { cents: Number(account.balanceCents), currency: 'BRL' as const },
      initialBalance: { cents: Number(account.initialBalanceCents), currency: 'BRL' as const },
    };
  });

  app.get('/:id/transactions', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      querystring: paginationSchema.merge(dateRangeSchema).merge(z.object({
        categoryId: z.string().uuid().optional(),
        type: z.enum(['EXPENSE', 'INCOME', 'TRANSFER']).optional(),
      })),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { page, limit, startDate, endDate, categoryId, type } = request.query;

    const conditions = [
      eq(transaction.accountId, request.params.id),
      eq(transaction.userId, request.authUser!.id),
    ];
    if (startDate) conditions.push(gte(transaction.date, new Date(startDate)));
    if (endDate) conditions.push(lte(transaction.date, new Date(endDate)));
    if (categoryId) conditions.push(eq(transaction.categoryId, categoryId));
    if (type) conditions.push(eq(transaction.type, type));

    const [transactions, totalResult] = await Promise.all([
      app.db.select({
        transaction,
        category: category,
      })
        .from(transaction)
        .leftJoin(category, eq(transaction.categoryId, category.id))
        .where(and(...conditions))
        .orderBy(desc(transaction.date))
        .limit(limit)
        .offset((page - 1) * limit),
      app.db.select({ count: count() }).from(transaction).where(and(...conditions)),
    ]);

    const total = totalResult[0]?.count || 0;

    return {
      data: transactions.map((t) => ({
        ...t.transaction,
        amount: { cents: Number(t.transaction.amountCents), currency: 'BRL' as const },
        category: t.category,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.patch('/:id', {
    schema: updateAccountSchema,
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [existing] = await app.db.select()
      .from(bankAccount)
      .where(and(eq(bankAccount.id, request.params.id), eq(bankAccount.userId, request.authUser!.id)))
      .limit(1);

    if (!existing) {
      throw app.httpErrors.notFound('Account not found');
    }

    const [account] = await app.db.update(bankAccount)
      .set(request.body)
      .where(eq(bankAccount.id, request.params.id))
      .returning();

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'ACCOUNT_UPDATED',
      entityType: 'BankAccount',
      entityId: account.id,
      oldData: existing,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      ...account,
      balance: { cents: Number(account.balanceCents), currency: 'BRL' as const },
      initialBalance: { cents: Number(account.initialBalanceCents), currency: 'BRL' as const },
    };
  });

  app.delete('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
const [existing] = await app.db.select()
      .from(bankAccount)
      .where(and(eq(bankAccount.id, request.params.id), eq(bankAccount.userId, request.authUser!.id)))
      .limit(1);

    if (!existing) {
      throw app.httpErrors.notFound('Account not found');
    }

    const [accountsTransactions, accountsBills, accountsRecurring, accountsCards] = await Promise.all([
      app.db.select().from(transaction).where(and(eq(transaction.accountId, request.params.id), eq(transaction.userId, request.authUser!.id))).limit(1),
      app.db.select().from(bill).where(and(eq(bill.accountId, request.params.id), eq(bill.userId, request.authUser!.id))).limit(1),
      app.db.select().from(recurringBill).where(and(eq(recurringBill.accountId, request.params.id), eq(recurringBill.userId, request.authUser!.id))).limit(1),
      app.db.select().from(creditCard).where(and(eq(creditCard.accountId, request.params.id), eq(creditCard.userId, request.authUser!.id))).limit(1),
    ]);

    if (accountsTransactions.length > 0 || accountsBills.length > 0 || accountsRecurring.length > 0 || accountsCards.length > 0) {
      throw app.httpErrors.conflict('Não é possível excluir esta conta porque existem transações, contas recorrentes ou cartões vinculados a ela.');
    }

    await app.db.delete(bankAccount).where(eq(bankAccount.id, request.params.id));

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'ACCOUNT_DELETED',
      entityType: 'BankAccount',
      entityId: request.params.id,
      oldData: existing,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });
};

export default accountsRoutes;