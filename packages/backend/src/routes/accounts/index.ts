import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createAccountSchema, updateAccountSchema, paginationSchema, dateRangeSchema } from '../../types/schemas.js';

const accountsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    schema: {
      querystring: paginationSchema.merge(dateRangeSchema),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { page, limit, startDate, endDate } = request.query;
    const userId = request.authUser!.id;

    const where: any = { userId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [accounts, total] = await Promise.all([
      app.prisma.bankAccount.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      app.prisma.bankAccount.count({ where }),
    ]);

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
  }, async (request, reply) => {
    const account = await app.prisma.bankAccount.create({
      data: {
        ...request.body,
        userId: request.authUser!.id,
        initialBalanceCents: request.body.initialBalance,
        balanceCents: request.body.initialBalance,
      },
    });

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
      params: z.object({ id: z.string().cuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const account = await app.prisma.bankAccount.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
    });

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
      params: z.object({ id: z.string().cuid() }),
      querystring: paginationSchema.merge(dateRangeSchema).merge(z.object({
        categoryId: z.string().cuid().optional(),
        type: z.enum(['EXPENSE', 'INCOME', 'TRANSFER']).optional(),
      })),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { page, limit, startDate, endDate, categoryId, type } = request.query;

    const where: any = { accountId: request.params.id, userId: request.authUser!.id };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }
    if (categoryId) where.categoryId = categoryId;
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      app.prisma.transaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { category: true },
      }),
      app.prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions.map((t) => ({
        ...t,
        amount: { cents: Number(t.amountCents), currency: 'BRL' as const },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.patch('/:id', {
    schema: updateAccountSchema,
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const existing = await app.prisma.bankAccount.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
    });

    if (!existing) {
      throw app.httpErrors.notFound('Account not found');
    }

    const account = await app.prisma.bankAccount.update({
      where: { id: request.params.id },
      data: request.body,
    });

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
      params: z.object({ id: z.string().cuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const existing = await app.prisma.bankAccount.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
    });

    if (!existing) {
      throw app.httpErrors.notFound('Account not found');
    }

    const account = await app.prisma.bankAccount.update({
      where: { id: request.params.id },
      data: { status: 'INACTIVE' },
    });

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'ACCOUNT_DEACTIVATED',
      entityType: 'BankAccount',
      entityId: account.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });
};

export default accountsRoutes;