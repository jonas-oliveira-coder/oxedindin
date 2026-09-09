import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createCardSchema, updateCardSchema, paginationSchema } from '../../types/schemas.js';

const cardsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    schema: {
      querystring: paginationSchema,
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { page, limit } = request.query;
    const userId = request.authUser!.id;

    const [cards, total] = await Promise.all([
      app.prisma.creditCard.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { account: true },
      }),
      app.prisma.creditCard.count({ where: { userId } }),
    ]);

    return {
      data: cards.map((c) => ({
        ...c,
        limit: { cents: Number(c.limitCents), currency: 'BRL' as const },
        availableLimit: { cents: Number(c.availableLimitCents), currency: 'BRL' as const },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.post('/', {
    schema: createCardSchema,
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    if (request.body.accountId) {
      const account = await app.prisma.bankAccount.findFirst({
        where: { id: request.body.accountId, userId: request.authUser!.id },
      });
      if (!account) {
        throw app.httpErrors.badRequest('Account not found');
      }
    }

    const card = await app.prisma.creditCard.create({
      data: {
        ...request.body,
        userId: request.authUser!.id,
        limitCents: request.body.limit,
        availableLimitCents: request.body.limit,
      },
      include: { account: true },
    });

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'CARD_CREATED',
      entityType: 'CreditCard',
      entityId: card.id,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({
      ...card,
      limit: { cents: Number(card.limitCents), currency: 'BRL' as const },
      availableLimit: { cents: Number(card.availableLimitCents), currency: 'BRL' as const },
    });
  });

  app.get('/:id', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const card = await app.prisma.creditCard.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
      include: { account: true },
    });

    if (!card) {
      throw app.httpErrors.notFound('Card not found');
    }

    return {
      ...card,
      limit: { cents: Number(card.limitCents), currency: 'BRL' as const },
      availableLimit: { cents: Number(card.availableLimitCents), currency: 'BRL' as const },
    };
  });

  app.get('/:id/invoices', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
      querystring: paginationSchema,
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { page, limit } = request.query;

    const card = await app.prisma.creditCard.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
    });

    if (!card) {
      throw app.httpErrors.notFound('Card not found');
    }

    const [invoices, total] = await Promise.all([
      app.prisma.invoice.findMany({
        where: { cardId: card.id },
        orderBy: { periodStart: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      app.prisma.invoice.count({ where: { cardId: card.id } }),
    ]);

    return {
      data: invoices.map((i) => ({
        ...i,
        total: { cents: Number(i.totalCents), currency: 'BRL' as const },
        paid: { cents: Number(i.paidCents), currency: 'BRL' as const },
        remaining: { cents: Number(i.remainingCents), currency: 'BRL' as const },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.get('/:id/invoices/current', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const card = await app.prisma.creditCard.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
    });

    if (!card) {
      throw app.httpErrors.notFound('Card not found');
    }

    const now = new Date();
    const invoice = await app.prisma.invoice.findFirst({
      where: {
        cardId: card.id,
        periodStart: { lte: now },
        periodEnd: { gte: now },
      },
      orderBy: { periodStart: 'desc' },
      include: { transactions: { include: { category: true } } },
    });

    if (!invoice) {
      throw app.httpErrors.notFound('Current invoice not found');
    }

    return {
      ...invoice,
      total: { cents: Number(invoice.totalCents), currency: 'BRL' as const },
      paid: { cents: Number(invoice.paidCents), currency: 'BRL' as const },
      remaining: { cents: Number(invoice.remainingCents), currency: 'BRL' as const },
      transactions: invoice.transactions.map((t) => ({
        ...t,
        amount: { cents: Number(t.amountCents), currency: 'BRL' as const },
      })),
    };
  });

  app.get('/:id/invoices/next', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const card = await app.prisma.creditCard.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
    });

    if (!card) {
      throw app.httpErrors.notFound('Card not found');
    }

    const now = new Date();
    const nextInvoice = await app.prisma.invoice.findFirst({
      where: {
        cardId: card.id,
        periodStart: { gt: now },
      },
      orderBy: { periodStart: 'asc' },
    });

    if (!nextInvoice) {
      throw app.httpErrors.notFound('Next invoice not found');
    }

    return {
      ...nextInvoice,
      total: { cents: Number(nextInvoice.totalCents), currency: 'BRL' as const },
      paid: { cents: Number(nextInvoice.paidCents), currency: 'BRL' as const },
      remaining: { cents: Number(nextInvoice.remainingCents), currency: 'BRL' as const },
    };
  });

  app.get('/:id/installments', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
      querystring: paginationSchema,
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { page, limit } = request.query;

    const card = await app.prisma.creditCard.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
    });

    if (!card) {
      throw app.httpErrors.notFound('Card not found');
    }

    const [installments, total] = await Promise.all([
      app.prisma.installment.findMany({
        where: {
          plan: { cardId: card.id },
          status: { in: ['PENDING', 'OVERDUE'] },
        },
        orderBy: { dueDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { plan: true, invoice: true },
      }),
      app.prisma.installment.count({
        where: {
          plan: { cardId: card.id },
          status: { in: ['PENDING', 'OVERDUE'] },
        },
      }),
    ]);

    return {
      data: installments.map((i) => ({
        ...i,
        amount: { cents: Number(i.amountCents), currency: 'BRL' as const },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.patch('/:id', {
    schema: updateCardSchema,
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const existing = await app.prisma.creditCard.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
    });

    if (!existing) {
      throw app.httpErrors.notFound('Card not found');
    }

    if (request.body.accountId) {
      const account = await app.prisma.bankAccount.findFirst({
        where: { id: request.body.accountId, userId: request.authUser!.id },
      });
      if (!account) {
        throw app.httpErrors.badRequest('Account not found');
      }
    }

    const updateData = { ...request.body };
    if (updateData.limit !== undefined) {
      updateData.limitCents = updateData.limit;
      updateData.availableLimitCents = updateData.limit;
      delete updateData.limit;
    }

    const card = await app.prisma.creditCard.update({
      where: { id: request.params.id },
      data: updateData,
      include: { account: true },
    });

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'CARD_UPDATED',
      entityType: 'CreditCard',
      entityId: card.id,
      oldData: existing,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      ...card,
      limit: { cents: Number(card.limitCents), currency: 'BRL' as const },
      availableLimit: { cents: Number(card.availableLimitCents), currency: 'BRL' as const },
    };
  });

  app.delete('/:id', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const existing = await app.prisma.creditCard.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
    });

    if (!existing) {
      throw app.httpErrors.notFound('Card not found');
    }

    const card = await app.prisma.creditCard.update({
      where: { id: request.params.id },
      data: { status: 'INACTIVE' },
    });

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'CARD_DEACTIVATED',
      entityType: 'CreditCard',
      entityId: card.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });
};

export default cardsRoutes;