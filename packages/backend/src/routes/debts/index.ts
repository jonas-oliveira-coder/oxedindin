import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createDebtSchema, paginationSchema, dateRangeSchema } from '../../types/schemas.js';

const debtsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    schema: {
      querystring: paginationSchema.merge(dateRangeSchema).merge(z.object({
        status: z.enum(['ACTIVE', 'PAID', 'OVERDUE', 'CANCELLED', 'RENEGOTIATED']).optional(),
        type: z.enum(['PERSONAL_LOAN', 'CREDIT_CARD', 'PURCHASE', 'BORROWED_MONEY', 'OTHER']).optional(),
      })),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { page, limit, startDate, endDate, status, type } = request.query;
    const userId = request.authUser!.id;

    const where: any = { userId };
    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) where.dueDate.gte = new Date(startDate);
      if (endDate) where.dueDate.lte = new Date(endDate);
    }
    if (status) where.status = status;
    if (type) where.type = type;

    const [debts, total] = await Promise.all([
      app.prisma.debt.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { relatedPerson: true, sharedDebts: { include: { debtor: true } } },
      }),
      app.prisma.debt.count({ where }),
    ]);

    return {
      data: debts.map((d) => ({
        ...d,
        totalAmount: { cents: Number(d.totalAmountCents), currency: 'BRL' as const },
        paidAmount: { cents: Number(d.paidAmountCents), currency: 'BRL' as const },
        remainingAmount: { cents: Number(d.remainingAmountCents), currency: 'BRL' as const },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.post('/', {
    schema: createDebtSchema,
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { description, totalAmount, dueDate, type, relatedPersonId, notes } = request.body;
    const userId = request.authUser!.id;

    if (relatedPersonId) {
      const person = await app.prisma.person.findFirst({ where: { id: relatedPersonId, userId } });
      if (!person) throw app.httpErrors.badRequest('Person not found');
    }

    const debt = await app.prisma.debt.create({
      data: {
        userId,
        description,
        totalAmountCents: totalAmount,
        paidAmountCents: 0,
        remainingAmountCents: totalAmount,
        dueDate: new Date(dueDate),
        type,
        relatedPersonId,
        notes,
        status: 'ACTIVE',
      },
      include: { relatedPerson: true },
    });

    await app.auditLog({
      userId,
      action: 'DEBT_CREATED',
      entityType: 'Debt',
      entityId: debt.id,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({
      ...debt,
      totalAmount: { cents: Number(debt.totalAmountCents), currency: 'BRL' as const },
      paidAmount: { cents: Number(debt.paidAmountCents), currency: 'BRL' as const },
      remainingAmount: { cents: Number(debt.remainingAmountCents), currency: 'BRL' as const },
    });
  });

  app.get('/:id', {
    schema: { params: z.object({ id: z.string().cuid() }) },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const debt = await app.prisma.debt.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
      include: { relatedPerson: true, sharedDebts: { include: { debtor: true } } },
    });

    if (!debt) throw app.httpErrors.notFound('Debt not found');

    return {
      ...debt,
      totalAmount: { cents: Number(debt.totalAmountCents), currency: 'BRL' as const },
      paidAmount: { cents: Number(debt.paidAmountCents), currency: 'BRL' as const },
      remainingAmount: { cents: Number(debt.remainingAmountCents), currency: 'BRL' as const },
    };
  });

  app.patch('/:id', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
      body: z.object({
        description: z.string().min(1).max(200).optional(),
        totalAmount: z.number().int().positive().optional(),
        dueDate: z.string().datetime().optional(),
        type: z.enum(['PERSONAL_LOAN', 'CREDIT_CARD', 'PURCHASE', 'BORROWED_MONEY', 'OTHER']).optional(),
        relatedPersonId: z.string().cuid().nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
        status: z.enum(['ACTIVE', 'PAID', 'OVERDUE', 'CANCELLED', 'RENEGOTIATED']).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const existing = await app.prisma.debt.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
    });
    if (!existing) throw app.httpErrors.notFound('Debt not found');

    const updateData = { ...request.body };
    if (updateData.totalAmount !== undefined) {
      const paid = Number(existing.paidAmountCents);
      updateData.totalAmountCents = updateData.totalAmount;
      updateData.remainingAmountCents = updateData.totalAmount - paid;
      delete updateData.totalAmount;
    }

    const debt = await app.prisma.debt.update({
      where: { id: request.params.id },
      data: updateData,
      include: { relatedPerson: true },
    });

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'DEBT_UPDATED',
      entityType: 'Debt',
      entityId: debt.id,
      oldData: existing,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      ...debt,
      totalAmount: { cents: Number(debt.totalAmountCents), currency: 'BRL' as const },
      paidAmount: { cents: Number(debt.paidAmountCents), currency: 'BRL' as const },
      remainingAmount: { cents: Number(debt.remainingAmountCents), currency: 'BRL' as const },
    };
  });

  app.post('/:id/pay', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
      body: z.object({
        amount: z.number().int().positive(),
        accountId: z.string().cuid().optional(),
        date: z.string().datetime().optional(),
        notes: z.string().max(500).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { amount, accountId, date, notes } = request.body;
    const userId = request.authUser!.id;

    const existing = await app.prisma.debt.findFirst({
      where: { id: request.params.id, userId },
    });
    if (!existing) throw app.httpErrors.notFound('Debt not found');
    if (amount > Number(existing.remainingAmountCents)) throw app.httpErrors.badRequest('Payment exceeds remaining amount');

    if (accountId) {
      const account = await app.prisma.bankAccount.findFirst({ where: { id: accountId, userId } });
      if (!account) throw app.httpErrors.badRequest('Account not found');

      await app.prisma.bankAccount.update({
        where: { id: accountId },
        data: { balanceCents: { decrement: amount } },
      });
    }

    const newPaid = Number(existing.paidAmountCents) + amount;
    const newRemaining = Number(existing.totalAmountCents) - newPaid;
    const newStatus = newRemaining === 0 ? 'PAID' : 'ACTIVE';

    const debt = await app.prisma.debt.update({
      where: { id: request.params.id },
      data: {
        paidAmountCents: newPaid,
        remainingAmountCents: newRemaining,
        status: newStatus,
      },
      include: { relatedPerson: true },
    });

    if (accountId) {
      await app.prisma.transaction.create({
        data: {
          userId,
          description: `Pagamento dívida: ${debt.description}`,
          amountCents: amount,
          type: 'EXPENSE',
          date: date ? new Date(date) : new Date(),
          paymentMethod: 'BANK_TRANSFER',
          accountId,
          notes: notes || `Pagamento de dívida - ${debt.description}`,
        },
      });
    }

    await app.auditLog({
      userId,
      action: 'DEBT_PAYMENT',
      entityType: 'Debt',
      entityId: debt.id,
      newData: { amount, accountId },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      ...debt,
      totalAmount: { cents: Number(debt.totalAmountCents), currency: 'BRL' as const },
      paidAmount: { cents: Number(debt.paidAmountCents), currency: 'BRL' as const },
      remainingAmount: { cents: Number(debt.remainingAmountCents), currency: 'BRL' as const },
    };
  });

  app.delete('/:id', {
    schema: { params: z.object({ id: z.string().cuid() }) },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    await app.prisma.debt.update({
      where: { id: request.params.id },
      data: { status: 'CANCELLED' },
    });

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'DEBT_CANCELLED',
      entityType: 'Debt',
      entityId: request.params.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });

  app.get('/owed', {
    schema: {
      querystring: paginationSchema.merge(dateRangeSchema).merge(z.object({
        status: z.enum(['ACTIVE', 'PAID', 'OVERDUE', 'CANCELLED', 'RENEGOTIATED']).optional(),
      })),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { page, limit, startDate, endDate, status } = request.query;
    const userId = request.authUser!.id;

    const where: any = { relatedPerson: { userId } };
    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) where.dueDate.gte = new Date(startDate);
      if (endDate) where.dueDate.lte = new Date(endDate);
    }
    if (status) where.status = status;

    const [debts, total] = await Promise.all([
      app.prisma.debt.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { relatedPerson: true, sharedDebts: { include: { debtor: true, creditor: true } } },
      }),
      app.prisma.debt.count({ where }),
    ]);

    return {
      data: debts.map((d) => ({
        ...d,
        totalAmount: { cents: Number(d.totalAmountCents), currency: 'BRL' as const },
        paidAmount: { cents: Number(d.paidAmountCents), currency: 'BRL' as const },
        remainingAmount: { cents: Number(d.remainingAmountCents), currency: 'BRL' as const },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.post('/owed', {
    schema: {
      body: z.object({
        description: z.string().min(1).max(200),
        totalAmount: z.number().int().positive(),
        dueDate: z.string().datetime(),
        type: z.enum(['PERSONAL_LOAN', 'CREDIT_CARD', 'PURCHASE', 'BORROWED_MONEY', 'OTHER']),
        personId: z.string().cuid(),
        notes: z.string().max(500).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { description, totalAmount, dueDate, type, personId, notes } = request.body;
    const userId = request.authUser!.id;

    const person = await app.prisma.person.findFirst({ where: { id: personId, userId } });
    if (!person) throw app.httpErrors.badRequest('Person not found');

    const debt = await app.prisma.debt.create({
      data: {
        userId,
        description,
        totalAmountCents: totalAmount,
        paidAmountCents: 0,
        remainingAmountCents: totalAmount,
        dueDate: new Date(dueDate),
        type,
        relatedPersonId: personId,
        notes,
        status: 'ACTIVE',
      },
      include: { relatedPerson: true },
    });

    await app.auditLog({
      userId,
      action: 'OWED_DEBT_CREATED',
      entityType: 'Debt',
      entityId: debt.id,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({
      ...debt,
      totalAmount: { cents: Number(debt.totalAmountCents), currency: 'BRL' as const },
      paidAmount: { cents: Number(debt.paidAmountCents), currency: 'BRL' as const },
      remainingAmount: { cents: Number(debt.remainingAmountCents), currency: 'BRL' as const },
    });
  });

  app.get('/owed/:id', {
    schema: { params: z.object({ id: z.string().cuid() }) },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const debt = await app.prisma.debt.findFirst({
      where: { id: request.params.id, relatedPerson: { userId: request.authUser!.id } },
      include: { relatedPerson: true, sharedDebts: { include: { debtor: true, creditor: true } } },
    });

    if (!debt) throw app.httpErrors.notFound('Debt not found');

    return {
      ...debt,
      totalAmount: { cents: Number(debt.totalAmountCents), currency: 'BRL' as const },
      paidAmount: { cents: Number(debt.paidAmountCents), currency: 'BRL' as const },
      remainingAmount: { cents: Number(debt.remainingAmountCents), currency: 'BRL' as const },
    };
  });

  app.patch('/owed/:id', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
      body: z.object({
        description: z.string().min(1).max(200).optional(),
        totalAmount: z.number().int().positive().optional(),
        dueDate: z.string().datetime().optional(),
        type: z.enum(['PERSONAL_LOAN', 'CREDIT_CARD', 'PURCHASE', 'BORROWED_MONEY', 'OTHER']).optional(),
        notes: z.string().max(500).nullable().optional(),
        status: z.enum(['ACTIVE', 'PAID', 'OVERDUE', 'CANCELLED', 'RENEGOTIATED']).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const existing = await app.prisma.debt.findFirst({
      where: { id: request.params.id, relatedPerson: { userId: request.authUser!.id } },
    });
    if (!existing) throw app.httpErrors.notFound('Debt not found');

    const updateData = { ...request.body };
    if (updateData.totalAmount !== undefined) {
      const paid = Number(existing.paidAmountCents);
      updateData.totalAmountCents = updateData.totalAmount;
      updateData.remainingAmountCents = updateData.totalAmount - paid;
      delete updateData.totalAmount;
    }

    const debt = await app.prisma.debt.update({
      where: { id: request.params.id },
      data: updateData,
      include: { relatedPerson: true },
    });

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'OWED_DEBT_UPDATED',
      entityType: 'Debt',
      entityId: debt.id,
      oldData: existing,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      ...debt,
      totalAmount: { cents: Number(debt.totalAmountCents), currency: 'BRL' as const },
      paidAmount: { cents: Number(debt.paidAmountCents), currency: 'BRL' as const },
      remainingAmount: { cents: Number(debt.remainingAmountCents), currency: 'BRL' as const },
    };
  });

  app.post('/owed/:id/pay', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
      body: z.object({
        amount: z.number().int().positive(),
        date: z.string().datetime().optional(),
        notes: z.string().max(500).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { amount, date, notes } = request.body;
    const userId = request.authUser!.id;

    const existing = await app.prisma.debt.findFirst({
      where: { id: request.params.id, relatedPerson: { userId } },
    });
    if (!existing) throw app.httpErrors.notFound('Debt not found');
    if (amount > Number(existing.remainingAmountCents)) throw app.httpErrors.badRequest('Payment exceeds remaining amount');

    const newPaid = Number(existing.paidAmountCents) + amount;
    const newRemaining = Number(existing.totalAmountCents) - newPaid;
    const newStatus = newRemaining === 0 ? 'PAID' : 'ACTIVE';

    const debt = await app.prisma.debt.update({
      where: { id: request.params.id },
      data: {
        paidAmountCents: newPaid,
        remainingAmountCents: newRemaining,
        status: newStatus,
      },
      include: { relatedPerson: true },
    });

    await app.auditLog({
      userId,
      action: 'OWED_DEBT_PAYMENT_RECEIVED',
      entityType: 'Debt',
      entityId: debt.id,
      newData: { amount },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      ...debt,
      totalAmount: { cents: Number(debt.totalAmountCents), currency: 'BRL' as const },
      paidAmount: { cents: Number(debt.paidAmountCents), currency: 'BRL' as const },
      remainingAmount: { cents: Number(debt.remainingAmountCents), currency: 'BRL' as const },
    };
  });

  app.post('/owed/:id/share', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
      body: z.object({
        email: z.string().email(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { email } = request.body;
    const userId = request.authUser!.id;

    const debt = await app.prisma.debt.findFirst({
      where: { id: request.params.id, relatedPerson: { userId } },
      include: { relatedPerson: true },
    });
    if (!debt) throw app.httpErrors.notFound('Debt not found');

    const debtorUser = await app.prisma.user.findUnique({ where: { email } });

    if (debtorUser) {
      const existingShare = await app.prisma.sharedDebt.findFirst({
        where: { debtId: debt.id, debtorUserId: debtorUser.id },
      });
      if (existingShare) throw app.httpErrors.conflict('Debt already shared with this user');

      const sharedDebt = await app.prisma.sharedDebt.create({
        data: {
          debtId: debt.id,
          debtorUserId: debtorUser.id,
          creditorUserId: userId,
          status: 'PENDING',
          notifiedAt: new Date(),
        },
      });

      await app.prisma.notification.create({
        data: {
          userId: debtorUser.id,
          type: 'SHARED_DEBT_ADDED',
          title: 'Nova dívida compartilhada',
          message: `${request.authUser!.name} registrou uma dívida de ${(Number(debt.remainingAmountCents) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em seu nome: ${debt.description}`,
          channels: ['IN_APP'],
          relatedEntityType: 'SharedDebt',
          relatedEntityId: sharedDebt.id,
        },
      });

      app.broadcast(debtorUser.id, {
        type: 'notification',
        data: { type: 'SHARED_DEBT_ADDED', debtId: debt.id, sharedDebtId: sharedDebt.id },
      });
    } else {
      if (!debt.relatedPerson?.email) {
        await app.prisma.person.update({
          where: { id: debt.relatedPersonId! },
          data: { email },
        });
      }
    }

    await app.auditLog({
      userId,
      action: 'DEBT_SHARED',
      entityType: 'Debt',
      entityId: debt.id,
      newData: { email },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true, shared: !!debtorUser };
  });
};

export default debtsRoutes;