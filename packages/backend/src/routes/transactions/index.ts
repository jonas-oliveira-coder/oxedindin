import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createTransactionSchema, paginationSchema, dateRangeSchema } from '../../types/schemas.js';

function calculateInstallmentValue(totalCents: number, count: number): number[] {
  const baseValue = Math.floor(totalCents / count);
  const remainder = totalCents % count;
  const values: number[] = [];

  for (let i = 0; i < count; i++) {
    values.push(baseValue + (i < remainder ? 1 : 0));
  }

  return values;
}

function getInvoicePeriod(date: Date, closingDay: number): { start: Date; end: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();

  let closingDate = new Date(year, month, closingDay);
  if (closingDate > date) {
    closingDate = new Date(year, month - 1, closingDay);
  }

  const periodStart = new Date(closingDate);
  periodStart.setDate(periodStart.getDate() + 1);

  const periodEnd = new Date(closingDate);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  return { start: periodStart, end: periodEnd };
}

function getInvoiceForDate(date: Date, closingDay: number, dueDay: number): { closingDate: Date; dueDate: Date; periodStart: Date; periodEnd: Date } {
  const { start, end } = getInvoicePeriod(date, closingDay);

  const dueDate = new Date(end);
  dueDate.setDate(dueDay);
  if (dueDate <= end) {
    dueDate.setMonth(dueDate.getMonth() + 1);
  }

  const closingDate = new Date(end);

  return { closingDate, dueDate, periodStart: start, periodEnd: end };
}

const transactionsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    schema: {
      querystring: paginationSchema.merge(dateRangeSchema).merge(z.object({
        categoryId: z.string().cuid().optional(),
        accountId: z.string().cuid().optional(),
        cardId: z.string().cuid().optional(),
        type: z.enum(['EXPENSE', 'INCOME', 'TRANSFER']).optional(),
      })),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { page, limit, startDate, endDate, categoryId, accountId, cardId, type } = request.query;
    const userId = request.authUser!.id;

    const where: any = { userId };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }
    if (categoryId) where.categoryId = categoryId;
    if (accountId) where.accountId = accountId;
    if (cardId) where.cardId = cardId;
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      app.prisma.transaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { category: true, account: true, card: true },
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

  app.get('/summary', {
    schema: {
      querystring: z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { month } = request.query;
    const userId = request.authUser!.id;

    const date = month ? new Date(`${month}-01`) : new Date();
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

    const [expenses, income] = await Promise.all([
      app.prisma.transaction.aggregate({
        where: {
          userId,
          type: 'EXPENSE',
          date: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amountCents: true },
      }),
      app.prisma.transaction.aggregate({
        where: {
          userId,
          type: 'INCOME',
          date: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amountCents: true },
      }),
    ]);

    return {
      month: date.toISOString().slice(0, 7),
      expenses: { cents: Number(expenses._sum.amountCents || 0), currency: 'BRL' as const },
      income: { cents: Number(income._sum.amountCents || 0), currency: 'BRL' as const },
      balance: { cents: Number((income._sum.amountCents || 0) - (expenses._sum.amountCents || 0)), currency: 'BRL' as const },
    };
  });

  app.post('/', {
    schema: createTransactionSchema,
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { description, amount, type, categoryId, date, paymentMethod, accountId, cardId, notes } = request.body;
    const userId = request.authUser!.id;

    if (accountId) {
      const account = await app.prisma.bankAccount.findFirst({
        where: { id: accountId, userId },
      });
      if (!account) throw app.httpErrors.badRequest('Account not found');
    }

    if (cardId) {
      const card = await app.prisma.creditCard.findFirst({
        where: { id: cardId, userId },
      });
      if (!card) throw app.httpErrors.badRequest('Card not found');
    }

    if (categoryId) {
      const category = await app.prisma.category.findFirst({
        where: { id: categoryId, userId },
      });
      if (!category) throw app.httpErrors.badRequest('Category not found');
    }

    const transaction = await app.prisma.transaction.create({
      data: {
        userId,
        description,
        amountCents: amount,
        type,
        categoryId,
        date: new Date(date),
        paymentMethod,
        accountId,
        cardId,
        notes,
      },
      include: { category: true, account: true, card: true },
    });

    if (accountId && type === 'EXPENSE') {
      await app.prisma.bankAccount.update({
        where: { id: accountId },
        data: { balanceCents: { decrement: amount } },
      });
    } else if (accountId && type === 'INCOME') {
      await app.prisma.bankAccount.update({
        where: { id: accountId },
        data: { balanceCents: { increment: amount } },
      });
    }

    if (cardId) {
      const card = await app.prisma.creditCard.findUnique({ where: { id: cardId } });
      if (card) {
        const { closingDate, dueDate, periodStart, periodEnd } = getInvoiceForDate(
          new Date(date),
          card.closingDay,
          card.dueDay
        );

        let invoice = await app.prisma.invoice.findFirst({
          where: { cardId, periodStart, periodEnd },
        });

        if (!invoice) {
          invoice = await app.prisma.invoice.create({
            data: {
              cardId,
              periodStart,
              periodEnd,
              closingDate,
              dueDate,
              totalCents: 0,
              paidCents: 0,
              remainingCents: 0,
              status: 'OPEN',
            },
          });
        }

        await app.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            totalCents: { increment: amount },
            remainingCents: { increment: amount },
          },
        });

        await app.prisma.creditCard.update({
          where: { id: cardId },
          data: { availableLimitCents: { decrement: amount } },
        });

        await app.prisma.transaction.update({
          where: { id: transaction.id },
          data: { installmentPlanId: null },
        });
      }
    }

    await app.auditLog({
      userId,
      action: 'TRANSACTION_CREATED',
      entityType: 'Transaction',
      entityId: transaction.id,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({
      ...transaction,
      amount: { cents: Number(transaction.amountCents), currency: 'BRL' as const },
    });
  });

  app.post('/installment', {
    schema: {
      body: z.object({
        description: z.string().min(1).max(200),
        totalAmount: z.number().int().positive(),
        installmentsCount: z.number().int().positive().max(60),
        startDate: z.string().datetime(),
        firstInvoiceDate: z.string().datetime(),
        cardId: z.string().cuid(),
        categoryId: z.string().cuid().optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { description, totalAmount, installmentsCount, startDate, firstInvoiceDate, cardId, categoryId } = request.body;
    const userId = request.authUser!.id;

    const card = await app.prisma.creditCard.findFirst({
      where: { id: cardId, userId },
    });
    if (!card) throw app.httpErrors.badRequest('Card not found');

    if (categoryId) {
      const category = await app.prisma.category.findFirst({
        where: { id: categoryId, userId },
      });
      if (!category) throw app.httpErrors.badRequest('Category not found');
    }

    if (totalAmount > Number(card.availableLimitCents)) {
      throw app.httpErrors.badRequest('Insufficient available limit');
    }

    const installmentValues = calculateInstallmentValue(totalAmount, installmentsCount);
    const installmentValue = installmentValues[0];

    const plan = await app.prisma.installmentPlan.create({
      data: {
        userId,
        cardId,
        description,
        totalAmountCents: totalAmount,
        installmentsCount,
        installmentValueCents: installmentValue,
        startDate: new Date(startDate),
        firstInvoiceDate: new Date(firstInvoiceDate),
        categoryId,
      },
    });

    const installments = [];
    for (let i = 0; i < installmentsCount; i++) {
      const dueDate = new Date(firstInvoiceDate);
      dueDate.setMonth(dueDate.getMonth() + i);

      const invoiceInfo = getInvoiceForDate(dueDate, card.closingDay, card.dueDay);

      let invoice = await app.prisma.invoice.findFirst({
        where: { cardId, periodStart: invoiceInfo.periodStart, periodEnd: invoiceInfo.periodEnd },
      });

      if (!invoice) {
        invoice = await app.prisma.invoice.create({
          data: {
            cardId,
            periodStart: invoiceInfo.periodStart,
            periodEnd: invoiceInfo.periodEnd,
            closingDate: invoiceInfo.closingDate,
            dueDate: invoiceInfo.dueDate,
            totalCents: 0,
            paidCents: 0,
            remainingCents: 0,
            status: 'OPEN',
          },
        });
      }

      const installment = await app.prisma.installment.create({
        data: {
          planId: plan.id,
          invoiceId: invoice.id,
          number: i + 1,
          amountCents: installmentValues[i],
          dueDate: invoiceInfo.dueDate,
          status: 'PENDING',
        },
      });

      await app.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          totalCents: { increment: installmentValues[i] },
          remainingCents: { increment: installmentValues[i] },
        },
      });

      installments.push(installment);
    }

    await app.prisma.creditCard.update({
      where: { id: cardId },
      data: { availableLimitCents: { decrement: totalAmount } },
    });

    await app.auditLog({
      userId,
      action: 'INSTALLMENT_PLAN_CREATED',
      entityType: 'InstallmentPlan',
      entityId: plan.id,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({
      ...plan,
      totalAmount: { cents: Number(plan.totalAmountCents), currency: 'BRL' as const },
      installmentValue: { cents: Number(plan.installmentValueCents), currency: 'BRL' as const },
      installments: installments.map((i) => ({
        ...i,
        amount: { cents: Number(i.amountCents), currency: 'BRL' as const },
      })),
    });
  });

  app.get('/:id', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const transaction = await app.prisma.transaction.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
      include: { category: true, account: true, card: true },
    });

    if (!transaction) {
      throw app.httpErrors.notFound('Transaction not found');
    }

    return {
      ...transaction,
      amount: { cents: Number(transaction.amountCents), currency: 'BRL' as const },
    };
  });

  app.patch('/:id', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
      body: z.object({
        description: z.string().min(1).max(200).optional(),
        amount: z.number().int().optional(),
        categoryId: z.string().cuid().nullable().optional(),
        date: z.string().datetime().optional(),
        paymentMethod: z.enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'PIX', 'BANK_TRANSFER', 'BOLETO', 'OTHER']).optional(),
        notes: z.string().max(500).nullable().optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const existing = await app.prisma.transaction.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
    });

    if (!existing) {
      throw app.httpErrors.notFound('Transaction not found');
    }

    const transaction = await app.prisma.transaction.update({
      where: { id: request.params.id },
      data: request.body,
      include: { category: true, account: true, card: true },
    });

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'TRANSACTION_UPDATED',
      entityType: 'Transaction',
      entityId: transaction.id,
      oldData: existing,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      ...transaction,
      amount: { cents: Number(transaction.amountCents), currency: 'BRL' as const },
    };
  });

  app.delete('/:id', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const existing = await app.prisma.transaction.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
    });

    if (!existing) {
      throw app.httpErrors.notFound('Transaction not found');
    }

    await app.prisma.transaction.delete({ where: { id: request.params.id } });

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'TRANSACTION_DELETED',
      entityType: 'Transaction',
      entityId: request.params.id,
      oldData: existing,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });
};

export default transactionsRoutes;