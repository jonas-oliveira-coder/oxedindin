import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createRecurringBillSchema, createBillSchema, paginationSchema, dateRangeSchema } from '../../types/schemas.js';

function getNextDueDate(frequency: string, dueDay: number, fromDate: Date): Date {
  const next = new Date(fromDate);
  switch (frequency) {
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      break;
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'BIWEEKLY':
      next.setDate(next.getDate() + 14);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      next.setDate(Math.min(dueDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      break;
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + 3);
      next.setDate(Math.min(dueDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      break;
    case 'SEMIANNUAL':
      next.setMonth(next.getMonth() + 6);
      next.setDate(Math.min(dueDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      break;
    case 'ANNUAL':
      next.setFullYear(next.getFullYear() + 1);
      next.setDate(Math.min(dueDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      break;
  }
  return next;
}

const billsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/recurring', {
    schema: {
      querystring: paginationSchema.merge(z.object({
        status: z.enum(['ACTIVE', 'INACTIVE', 'ENDED']).optional(),
      })),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { page, limit, status } = request.query;
    const userId = request.authUser!.id;

    const where: any = { userId };
    if (status) where.status = status;

    const [bills, total] = await Promise.all([
      app.prisma.recurringBill.findMany({
        where,
        orderBy: { nextDueDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { category: true, account: true, card: true },
      }),
      app.prisma.recurringBill.count({ where }),
    ]);

    return {
      data: bills.map((b) => ({
        ...b,
        amount: { cents: Number(b.amountCents), currency: 'BRL' as const },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.post('/recurring', {
    schema: createRecurringBillSchema,
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { description, amount, categoryId, frequency, dueDay, startDate, endDate, accountId, cardId, dateType } = request.body;
    const userId = request.authUser!.id;

    if (accountId) {
      const account = await app.prisma.bankAccount.findFirst({ where: { id: accountId, userId } });
      if (!account) throw app.httpErrors.badRequest('Account not found');
    }
    if (cardId) {
      const card = await app.prisma.creditCard.findFirst({ where: { id: cardId, userId } });
      if (!card) throw app.httpErrors.badRequest('Card not found');
    }
    if (categoryId) {
      const category = await app.prisma.category.findFirst({ where: { id: categoryId, userId } });
      if (!category) throw app.httpErrors.badRequest('Category not found');
    }

    const nextDueDate = getNextDueDate(frequency, dueDay, new Date(startDate));

    const bill = await app.prisma.recurringBill.create({
      data: {
        userId,
        description,
        amountCents: amount,
        categoryId,
        frequency,
        dueDay,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        nextDueDate,
        dateType: dateType || 'FIXED',
        accountId,
        cardId,
        status: 'ACTIVE',
      },
      include: { category: true, account: true, card: true },
    });

    await app.auditLog({
      userId,
      action: 'RECURRING_BILL_CREATED',
      entityType: 'RecurringBill',
      entityId: bill.id,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({
      ...bill,
      amount: { cents: Number(bill.amountCents), currency: 'BRL' as const },
    });
  });

  app.get('/recurring/:id', {
    schema: { params: z.object({ id: z.string().cuid() }) },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const bill = await app.prisma.recurringBill.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
      include: { category: true, account: true, card: true },
    });

    if (!bill) throw app.httpErrors.notFound('Recurring bill not found');

    return { ...bill, amount: { cents: Number(bill.amountCents), currency: 'BRL' as const } };
  });

  app.patch('/recurring/:id', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
      body: z.object({
        description: z.string().min(1).max(200).optional(),
        amount: z.number().int().positive().optional(),
        categoryId: z.string().cuid().nullable().optional(),
        frequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']).optional(),
        dueDay: z.number().int().min(1).max(31).optional(),
        endDate: z.string().datetime().nullable().optional(),
        accountId: z.string().cuid().nullable().optional(),
        cardId: z.string().cuid().nullable().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'ENDED']).optional(),
        dateType: z.enum(['FIXED', 'ADJUSTABLE']).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const existing = await app.prisma.recurringBill.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
    });
    if (!existing) throw app.httpErrors.notFound('Recurring bill not found');

    const bill = await app.prisma.recurringBill.update({
      where: { id: request.params.id },
      data: request.body,
      include: { category: true, account: true, card: true },
    });

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'RECURRING_BILL_UPDATED',
      entityType: 'RecurringBill',
      entityId: bill.id,
      oldData: existing,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { ...bill, amount: { cents: Number(bill.amountCents), currency: 'BRL' as const } };
  });

  app.delete('/recurring/:id', {
    schema: { params: z.object({ id: z.string().cuid() }) },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    await app.prisma.recurringBill.update({
      where: { id: request.params.id },
      data: { status: 'INACTIVE' },
    });

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'RECURRING_BILL_DEACTIVATED',
      entityType: 'RecurringBill',
      entityId: request.params.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });

  app.post('/recurring/:id/generate', {
    schema: { params: z.object({ id: z.string().cuid() }) },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const recurringBill = await app.prisma.recurringBill.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
    });
    if (!recurringBill) throw app.httpErrors.notFound('Recurring bill not found');

    const bill = await app.prisma.bill.create({
      data: {
        userId: request.authUser!.id,
        recurringBillId: recurringBill.id,
        description: recurringBill.description,
        amountCents: recurringBill.amountCents,
        categoryId: recurringBill.categoryId,
        dueDate: recurringBill.nextDueDate,
        status: 'PENDING',
        accountId: recurringBill.accountId,
      },
    });

    const nextDueDate = getNextDueDate(
      recurringBill.frequency,
      recurringBill.dueDay,
      recurringBill.nextDueDate
    );

    const updateData: any = { nextDueDate };
    if (recurringBill.endDate && nextDueDate > recurringBill.endDate) {
      updateData.status = 'ENDED';
    }

    await app.prisma.recurringBill.update({
      where: { id: recurringBill.id },
      data: updateData,
    });

    return { ...bill, amount: { cents: Number(bill.amountCents), currency: 'BRL' as const } };
  });

  app.get('/', {
    schema: {
      querystring: paginationSchema.merge(dateRangeSchema).merge(z.object({
        status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
      })),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { page, limit, startDate, endDate, status } = request.query;
    const userId = request.authUser!.id;

    const where: any = { userId };
    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) where.dueDate.gte = new Date(startDate);
      if (endDate) where.dueDate.lte = new Date(endDate);
    }
    if (status) where.status = status;

    const [bills, total] = await Promise.all([
      app.prisma.bill.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { category: true, account: true, recurringBill: true },
      }),
      app.prisma.bill.count({ where }),
    ]);

    return {
      data: bills.map((b) => ({
        ...b,
        amount: { cents: Number(b.amountCents), currency: 'BRL' as const },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.post('/', {
    schema: createBillSchema,
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { description, amount, categoryId, dueDate, paymentMethod, accountId, notes } = request.body;
    const userId = request.authUser!.id;

    if (accountId) {
      const account = await app.prisma.bankAccount.findFirst({ where: { id: accountId, userId } });
      if (!account) throw app.httpErrors.badRequest('Account not found');
    }
    if (categoryId) {
      const category = await app.prisma.category.findFirst({ where: { id: categoryId, userId } });
      if (!category) throw app.httpErrors.badRequest('Category not found');
    }

    const bill = await app.prisma.bill.create({
      data: {
        userId,
        description,
        amountCents: amount,
        categoryId,
        dueDate: new Date(dueDate),
        paymentMethod,
        accountId,
        notes,
        status: 'PENDING',
      },
      include: { category: true, account: true },
    });

    await app.auditLog({
      userId,
      action: 'BILL_CREATED',
      entityType: 'Bill',
      entityId: bill.id,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({ ...bill, amount: { cents: Number(bill.amountCents), currency: 'BRL' as const } });
  });

  app.get('/:id', {
    schema: { params: z.object({ id: z.string().cuid() }) },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const bill = await app.prisma.bill.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
      include: { category: true, account: true, recurringBill: true },
    });

    if (!bill) throw app.httpErrors.notFound('Bill not found');

    return { ...bill, amount: { cents: Number(bill.amountCents), currency: 'BRL' as const } };
  });

  app.patch('/:id', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
      body: z.object({
        description: z.string().min(1).max(200).optional(),
        amount: z.number().int().positive().optional(),
        categoryId: z.string().cuid().nullable().optional(),
        dueDate: z.string().datetime().optional(),
        paymentMethod: z.enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'PIX', 'BANK_TRANSFER', 'BOLETO', 'OTHER']).nullable().optional(),
        status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
        accountId: z.string().cuid().nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const existing = await app.prisma.bill.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
    });
    if (!existing) throw app.httpErrors.notFound('Bill not found');

    const bill = await app.prisma.bill.update({
      where: { id: request.params.id },
      data: request.body,
      include: { category: true, account: true, recurringBill: true },
    });

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'BILL_UPDATED',
      entityType: 'Bill',
      entityId: bill.id,
      oldData: existing,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { ...bill, amount: { cents: Number(bill.amountCents), currency: 'BRL' as const } };
  });

  app.post('/:id/pay', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
      body: z.object({
        accountId: z.string().cuid().optional(),
        date: z.string().datetime().optional(),
        paymentMethod: z.enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'PIX', 'BANK_TRANSFER', 'BOLETO', 'OTHER']).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { accountId, date, paymentMethod } = request.body;
    const userId = request.authUser!.id;

    const existing = await app.prisma.bill.findFirst({
      where: { id: request.params.id, userId },
    });
    if (!existing) throw app.httpErrors.notFound('Bill not found');
    if (existing.status === 'PAID') throw app.httpErrors.badRequest('Bill already paid');

    if (accountId) {
      const account = await app.prisma.bankAccount.findFirst({ where: { id: accountId, userId } });
      if (!account) throw app.httpErrors.badRequest('Account not found');

      await app.prisma.bankAccount.update({
        where: { id: accountId },
        data: { balanceCents: { decrement: existing.amountCents } },
      });
    }

    const bill = await app.prisma.bill.update({
      where: { id: request.params.id },
      data: {
        status: 'PAID',
        paidAt: date ? new Date(date) : new Date(),
        paymentMethod: paymentMethod || existing.paymentMethod,
        accountId: accountId || existing.accountId,
      },
      include: { category: true, account: true, recurringBill: true },
    });

    if (accountId) {
      await app.prisma.transaction.create({
        data: {
          userId,
          description: `Pagamento: ${bill.description}`,
          amountCents: bill.amountCents,
          type: 'EXPENSE',
          date: date ? new Date(date) : new Date(),
          paymentMethod: paymentMethod || 'BANK_TRANSFER',
          accountId,
          notes: `Pagamento de conta - ${bill.description}`,
        },
      });
    }

    await app.auditLog({
      userId,
      action: 'BILL_PAID',
      entityType: 'Bill',
      entityId: bill.id,
      newData: { accountId, paymentMethod },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { ...bill, amount: { cents: Number(bill.amountCents), currency: 'BRL' as const } };
  });

  app.delete('/:id', {
    schema: { params: z.object({ id: z.string().cuid() }) },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    await app.prisma.bill.update({
      where: { id: request.params.id },
      data: { status: 'CANCELLED' },
    });

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'BILL_CANCELLED',
      entityType: 'Bill',
      entityId: request.params.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });
};

export default billsRoutes;