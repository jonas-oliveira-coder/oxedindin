import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq, and, gt, count, sql, desc, asc, inArray, lte } from 'drizzle-orm';
import { paginationSchema } from '../../types/schemas.js';
import { invoice, creditCard, transaction, category, installment, installmentPlan, bankAccount } from '../../db/schema/index.js';

const invoicesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    schema: {
      querystring: paginationSchema.merge(z.object({
        cardId: z.string().uuid().optional(),
        status: z.enum(['OPEN', 'CLOSED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE']).optional(),
      })),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { page, limit, cardId, status } = request.query;
    const userId = request.authUser!.id;

    const cardConditions = [eq(creditCard.userId, userId)];
    if (cardId) cardConditions.push(eq(creditCard.id, cardId));
    const cardIdsData = await app.db.select({ id: creditCard.id })
      .from(creditCard)
      .where(and(...cardConditions));
    const cardIds = cardIdsData.map(c => c.id);

    const conditions = [inArray(invoice.cardId, cardIds)];
    if (status) conditions.push(eq(invoice.status, status));

    const [invoicesData, totalResult] = await Promise.all([
      app.db.select({
        invoice,
        card: creditCard,
        transaction,
        category,
      })
        .from(invoice)
        .leftJoin(creditCard, eq(invoice.cardId, creditCard.id))
        .leftJoin(transaction, eq(invoice.id, transaction.invoiceId))
        .leftJoin(category, eq(transaction.categoryId, category.id))
        .where(and(...conditions))
        .orderBy(desc(invoice.periodStart))
        .limit(limit)
        .offset((page - 1) * limit),
      app.db.select({ count: count() }).from(invoice).where(and(...conditions)),
    ]);

    const total = totalResult[0]?.count || 0;

    // Group transactions by invoice
    const invoiceMap = new Map<string, any>();
    for (const i of invoicesData) {
      if (!invoiceMap.has(i.invoice.id)) {
        invoiceMap.set(i.invoice.id, {
          ...i.invoice,
          card: i.card,
          transactions: [],
        });
      }
      if (i.transaction?.id) {
        invoiceMap.get(i.invoice.id).transactions.push({
          ...i.transaction,
          amount: { cents: Number(i.transaction.amountCents), currency: 'BRL' as const },
          category: i.category,
        });
      }
    }

    return {
      data: Array.from(invoiceMap.values()).map((i) => ({
        ...i,
        total: { cents: Number(i.totalCents), currency: 'BRL' as const },
        paid: { cents: Number(i.paidCents), currency: 'BRL' as const },
        remaining: { cents: Number(i.remainingCents), currency: 'BRL' as const },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.get('/upcoming', {
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const userId = request.authUser!.id;
    const now = new Date();

    const cards = await app.db.select()
      .from(creditCard)
      .where(and(eq(creditCard.userId, userId), eq(creditCard.status, 'ACTIVE')));

    const upcoming = [];
    for (const card of cards) {
      const [nextInvoice] = await app.db.select()
        .from(invoice)
        .where(and(eq(invoice.cardId, card.id), gt(invoice.periodStart, now)))
        .orderBy(asc(invoice.periodStart))
        .limit(1);

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
      params: z.object({ id: z.string().uuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [invoiceData] = await app.db.select({
      invoice,
      card: creditCard,
    })
      .from(invoice)
      .leftJoin(creditCard, eq(invoice.cardId, creditCard.id))
      .where(eq(invoice.id, request.params.id))
      .limit(1);

    if (!invoiceData) {
      throw app.httpErrors.notFound('Fatura não encontrada.');
    }

    const [card] = await app.db.select()
      .from(creditCard)
      .where(and(eq(creditCard.id, invoiceData.invoice.cardId), eq(creditCard.userId, request.authUser!.id)))
      .limit(1);

    if (!card) {
      throw app.httpErrors.forbidden('Acesso negado.');
    }

    const transactionsData = await app.db.select({
      transaction,
      category: category,
    })
      .from(transaction)
      .leftJoin(category, eq(transaction.categoryId, category.id))
      .where(eq(transaction.invoiceId, invoiceData.invoice.id));

    const installmentsData = await app.db.select({
      installment,
      plan: installmentPlan,
    })
      .from(installment)
      .leftJoin(installmentPlan, eq(installment.planId, installmentPlan.id))
      .where(eq(installment.invoiceId, invoiceData.invoice.id));

    return {
      ...invoiceData.invoice,
      card: invoiceData.card,
      total: { cents: Number(invoiceData.invoice.totalCents), currency: 'BRL' as const },
      paid: { cents: Number(invoiceData.invoice.paidCents), currency: 'BRL' as const },
      remaining: { cents: Number(invoiceData.invoice.remainingCents), currency: 'BRL' as const },
      transactions: transactionsData.map((t) => ({
        ...t.transaction,
        amount: { cents: Number(t.transaction.amountCents), currency: 'BRL' as const },
        category: t.category,
      })),
      installments: installmentsData.map((i) => ({
        ...i.installment,
        amount: { cents: Number(i.installment.amountCents), currency: 'BRL' as const },
        plan: i.plan,
      })),
    };
  });

  app.post('/:id/pay', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        amount: z.number().int().positive(),
        accountId: z.string().uuid().optional(),
        date: z.string().datetime().optional(),
        notes: z.string().max(500).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { amount, accountId, date, notes } = request.body;
    const userId = request.authUser!.id;

    const [invoiceData] = await app.db.select({
      invoice,
      card: creditCard,
    })
      .from(invoice)
      .leftJoin(creditCard, eq(invoice.cardId, creditCard.id))
      .where(eq(invoice.id, request.params.id))
      .limit(1);

    if (!invoiceData) {
      throw app.httpErrors.notFound('Fatura não encontrada.');
    }

    const [card] = await app.db.select()
      .from(creditCard)
      .where(and(eq(creditCard.id, invoiceData.invoice.cardId), eq(creditCard.userId, userId)))
      .limit(1);

    if (!card) {
      throw app.httpErrors.forbidden('Acesso negado.');
    }

    if (amount > Number(invoiceData.invoice.remainingCents)) {
      throw app.httpErrors.badRequest('O valor do pagamento excede o saldo restante.');
    }

    if (accountId) {
      const [account] = await app.db.select()
        .from(bankAccount)
        .where(and(eq(bankAccount.id, accountId), eq(bankAccount.userId, userId)))
        .limit(1);
      if (!account) throw app.httpErrors.badRequest('Conta não encontrada.');

      await app.db.update(bankAccount)
        .set({ balanceCents: sql`${bankAccount.balanceCents} - ${amount}` })
        .where(eq(bankAccount.id, accountId));
    }

    const newPaid = Number(invoiceData.invoice.paidCents) + amount;
    const newRemaining = Number(invoiceData.invoice.totalCents) - newPaid;
    const newStatus = newRemaining === 0 ? 'PAID' : newPaid > 0 ? 'PARTIALLY_PAID' : invoiceData.invoice.status;

    await app.db.update(invoice)
      .set({
        paidCents: BigInt(newPaid),
        remainingCents: BigInt(newRemaining),
        status: newStatus,
      })
      .where(eq(invoice.id, invoiceData.invoice.id));

    await app.db.update(creditCard)
      .set({ availableLimitCents: sql`${creditCard.availableLimitCents} + ${amount}` })
      .where(eq(creditCard.id, card.id));

    await app.db.insert(transaction).values({
      userId,
      description: `Pagamento fatura ${card.name} (${invoiceData.invoice.periodStart.toISOString().slice(0, 7)})`,
      amountCents: amount,
      type: 'EXPENSE',
      date: date ? new Date(date) : new Date(),
      paymentMethod: 'BANK_TRANSFER',
      accountId,
      cardId: card.id,
      notes: notes || `Pagamento de fatura - ${invoiceData.invoice.periodStart.toISOString().slice(0, 7)}`,
    });

    await app.auditLog({
      userId,
      action: 'INVOICE_PAID',
      entityType: 'Invoice',
      entityId: invoiceData.invoice.id,
      newData: { amount, accountId },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    const [updatedInvoice] = await app.db.select()
      .from(invoice)
      .where(eq(invoice.id, invoiceData.invoice.id))
      .limit(1);

    return {
      ...updatedInvoice!,
      total: { cents: Number(updatedInvoice!.totalCents), currency: 'BRL' as const },
      paid: { cents: Number(updatedInvoice!.paidCents), currency: 'BRL' as const },
      remaining: { cents: Number(updatedInvoice!.remainingCents), currency: 'BRL' as const },
    };
  });
};

export default invoicesRoutes;