import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { paginationSchema } from '../../types/schemas.js';

const invoicesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    schema: {
      querystring: paginationSchema.merge(z.object({
        cardId: z.string().cuid().optional(),
        status: z.enum(['OPEN', 'CLOSED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE']).optional(),
      })),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { page, limit, cardId, status } = request.query;
    const userId = request.authUser!.id;

    const cardWhere = cardId ? { id: cardId, userId } : { userId };
    const cardIds = await app.prisma.creditCard.findMany({
      where: cardWhere,
      select: { id: true },
    }).then((cards) => cards.map((c) => c.id));

    const where: any = { cardId: { in: cardIds } };
    if (status) where.status = status;

    const [invoices, total] = await Promise.all([
      app.prisma.invoice.findMany({
        where,
        orderBy: { periodStart: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { card: true, transactions: { include: { category: true } } },
      }),
      app.prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices.map((i) => ({
        ...i,
        total: { cents: Number(i.totalCents), currency: 'BRL' as const },
        paid: { cents: Number(i.paidCents), currency: 'BRL' as const },
        remaining: { cents: Number(i.remainingCents), currency: 'BRL' as const },
        transactions: i.transactions.map((t) => ({
          ...t,
          amount: { cents: Number(t.amountCents), currency: 'BRL' as const },
        })),
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.get('/upcoming', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.authUser!.id;
    const now = new Date();

    const cards = await app.prisma.creditCard.findMany({
      where: { userId, status: 'ACTIVE' },
    });

    const upcoming = [];
    for (const card of cards) {
      const nextInvoice = await app.prisma.invoice.findFirst({
        where: {
          cardId: card.id,
          periodStart: { gt: now },
        },
        orderBy: { periodStart: 'asc' },
      });

      if (nextInvoice) {
        upcoming.push({
          cardId: card.id,
          cardName: card.name,
          cardLast4: card.last4,
          ...nextInvoice,
          total: { cents: Number(nextInvoice.totalCents), currency: 'BRL' as const },
          paid: { cents: Number(nextInvoice.paidCents), currency: 'BRL' as const },
          remaining: { cents: Number(nextInvoice.remainingCents), currency: 'BRL' as const },
        });
      }
    }

    upcoming.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    return upcoming;
  });

  app.get('/:id', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const invoice = await app.prisma.invoice.findFirst({
      where: { id: request.params.id },
      include: {
        card: true,
        transactions: { include: { category: true } },
        installments: { include: { plan: true } },
      },
    });

    if (!invoice) {
      throw app.httpErrors.notFound('Invoice not found');
    }

    const card = await app.prisma.creditCard.findFirst({
      where: { id: invoice.cardId, userId: request.authUser!.id },
    });

    if (!card) {
      throw app.httpErrors.forbidden('Access denied');
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
      installments: invoice.installments.map((i) => ({
        ...i,
        amount: { cents: Number(i.amountCents), currency: 'BRL' as const },
      })),
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

    const invoice = await app.prisma.invoice.findFirst({
      where: { id: request.params.id },
      include: { card: true },
    });

    if (!invoice) {
      throw app.httpErrors.notFound('Invoice not found');
    }

    const card = await app.prisma.creditCard.findFirst({
      where: { id: invoice.cardId, userId },
    });

    if (!card) {
      throw app.httpErrors.forbidden('Access denied');
    }

    if (amount > Number(invoice.remainingCents)) {
      throw app.httpErrors.badRequest('Payment amount exceeds remaining balance');
    }

    if (accountId) {
      const account = await app.prisma.bankAccount.findFirst({
        where: { id: accountId, userId },
      });
      if (!account) throw app.httpErrors.badRequest('Account not found');

      await app.prisma.bankAccount.update({
        where: { id: accountId },
        data: { balanceCents: { decrement: amount } },
      });
    }

    const newPaid = Number(invoice.paidCents) + amount;
    const newRemaining = Number(invoice.totalCents) - newPaid;
    const newStatus = newRemaining === 0 ? 'PAID' : newPaid > 0 ? 'PARTIALLY_PAID' : invoice.status;

    await app.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        paidCents: newPaid,
        remainingCents: newRemaining,
        status: newStatus,
      },
    });

    await app.prisma.creditCard.update({
      where: { id: card.id },
      data: { availableLimitCents: { increment: amount } },
    });

    await app.prisma.transaction.create({
      data: {
        userId,
        description: `Pagamento fatura ${card.name} (${invoice.periodStart.toISOString().slice(0, 7)})`,
        amountCents: amount,
        type: 'EXPENSE',
        date: date ? new Date(date) : new Date(),
        paymentMethod: 'BANK_TRANSFER',
        accountId,
        cardId: card.id,
        notes: notes || `Pagamento de fatura - ${invoice.periodStart.toISOString().slice(0, 7)}`,
      },
    });

    await app.auditLog({
      userId,
      action: 'INVOICE_PAID',
      entityType: 'Invoice',
      entityId: invoice.id,
      newData: { amount, accountId },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    const updatedInvoice = await app.prisma.invoice.findUnique({ where: { id: invoice.id } });

    return {
      ...updatedInvoice!,
      total: { cents: Number(updatedInvoice!.totalCents), currency: 'BRL' as const },
      paid: { cents: Number(updatedInvoice!.paidCents), currency: 'BRL' as const },
      remaining: { cents: Number(updatedInvoice!.remainingCents), currency: 'BRL' as const },
    };
  });
};

export default invoicesRoutes;