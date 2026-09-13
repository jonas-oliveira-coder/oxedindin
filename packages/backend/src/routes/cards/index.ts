import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq, and, desc, gte, gt, lte, count, inArray } from 'drizzle-orm';
import { createCardSchema, updateCardSchema, paginationSchema } from '../../types/schemas.js';
import { creditCard, bankAccount, invoice, installment, installmentPlan, transaction, category } from '../../db/schema/index.js';

const cardsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    schema: {
      querystring: paginationSchema,
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { page, limit } = request.query;
    const userId = request.authUser!.id;

    const [cards, totalResult] = await Promise.all([
      app.db.select({
        creditCard,
        account: bankAccount,
      })
        .from(creditCard)
        .leftJoin(bankAccount, eq(creditCard.accountId, bankAccount.id))
        .where(eq(creditCard.userId, userId))
        .orderBy(desc(creditCard.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      app.db.select({ count: count() }).from(creditCard).where(eq(creditCard.userId, userId)),
    ]);

    const total = totalResult[0]?.count || 0;

    return {
      data: cards.map((c) => ({
        ...c.creditCard,
        account: c.account,
        limit: { cents: Number(c.creditCard.limitCents), currency: 'BRL' as const },
        availableLimit: { cents: Number(c.creditCard.availableLimitCents), currency: 'BRL' as const },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.post('/', {
    schema: createCardSchema,
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const body = request.body;
    if (body.accountId) {
      const [account] = await app.db.select()
        .from(bankAccount)
        .where(and(eq(bankAccount.id, body.accountId), eq(bankAccount.userId, request.authUser!.id)))
        .limit(1);
      if (!account) {
        throw app.httpErrors.badRequest('Account not found');
      }
    }

    const { limit, ...rest } = body;
    const [card] = await app.db.insert(creditCard).values({
      ...rest,
      userId: request.authUser!.id,
      limitCents: limit,
      availableLimitCents: limit,
    }).returning();

    const [cardWithAccount] = await app.db.select({
      creditCard,
      account: bankAccount,
    })
      .from(creditCard)
      .leftJoin(bankAccount, eq(creditCard.accountId, bankAccount.id))
      .where(eq(creditCard.id, card.id))
      .limit(1);

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
      ...cardWithAccount!.creditCard,
      account: cardWithAccount!.account,
      limit: { cents: Number(cardWithAccount!.creditCard.limitCents), currency: 'BRL' as const },
      availableLimit: { cents: Number(cardWithAccount!.creditCard.availableLimitCents), currency: 'BRL' as const },
    });
  });

  app.get('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [cardWithAccount] = await app.db.select({
      creditCard,
      account: bankAccount,
    })
      .from(creditCard)
      .leftJoin(bankAccount, eq(creditCard.accountId, bankAccount.id))
      .where(and(eq(creditCard.id, request.params.id), eq(creditCard.userId, request.authUser!.id)))
      .limit(1);

    if (!cardWithAccount) {
      throw app.httpErrors.notFound('Card not found');
    }

    return {
      ...cardWithAccount.creditCard,
      account: cardWithAccount.account,
      limit: { cents: Number(cardWithAccount.creditCard.limitCents), currency: 'BRL' as const },
      availableLimit: { cents: Number(cardWithAccount.creditCard.availableLimitCents), currency: 'BRL' as const },
    };
  });

  app.get('/:id/invoices', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      querystring: paginationSchema,
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { page, limit } = request.query;

    const [card] = await app.db.select()
      .from(creditCard)
      .where(and(eq(creditCard.id, request.params.id), eq(creditCard.userId, request.authUser!.id)))
      .limit(1);

    if (!card) {
      throw app.httpErrors.notFound('Card not found');
    }

    const [invoices, totalResult] = await Promise.all([
      app.db.select().from(invoice)
        .where(eq(invoice.cardId, card.id))
        .orderBy(desc(invoice.periodStart))
        .limit(limit)
        .offset((page - 1) * limit),
      app.db.select({ count: count() }).from(invoice).where(eq(invoice.cardId, card.id)),
    ]);

    const total = totalResult[0]?.count || 0;

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
      params: z.object({ id: z.string().uuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [card] = await app.db.select()
      .from(creditCard)
      .where(and(eq(creditCard.id, request.params.id), eq(creditCard.userId, request.authUser!.id)))
      .limit(1);

    if (!card) {
      throw app.httpErrors.notFound('Card not found');
    }

    const now = new Date();
    const [currentInvoice] = await app.db.select()
      .from(invoice)
      .where(and(
        eq(invoice.cardId, card.id),
        lte(invoice.periodStart, now),
        gte(invoice.periodEnd, now)
      ))
      .orderBy(desc(invoice.periodStart))
      .limit(1);

    if (!currentInvoice) {
      throw app.httpErrors.notFound('Current invoice not found');
    }

    const invoiceTransactions = await app.db.select({
      transaction,
      category: category,
    })
      .from(transaction)
      .leftJoin(category, eq(transaction.categoryId, category.id))
      .where(eq(transaction.invoiceId, currentInvoice.id))
      .orderBy(desc(transaction.date));

    return {
      ...currentInvoice,
      total: { cents: Number(currentInvoice.totalCents), currency: 'BRL' as const },
      paid: { cents: Number(currentInvoice.paidCents), currency: 'BRL' as const },
      remaining: { cents: Number(currentInvoice.remainingCents), currency: 'BRL' as const },
      transactions: invoiceTransactions.map((t) => ({
        ...t.transaction,
        amount: { cents: Number(t.transaction.amountCents), currency: 'BRL' as const },
        category: t.category,
      })),
    };
  });

  app.get('/:id/invoices/next', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [card] = await app.db.select()
      .from(creditCard)
      .where(and(eq(creditCard.id, request.params.id), eq(creditCard.userId, request.authUser!.id)))
      .limit(1);

    if (!card) {
      throw app.httpErrors.notFound('Card not found');
    }

    const now = new Date();
    const [nextInvoice] = await app.db.select()
      .from(invoice)
      .where(and(eq(invoice.cardId, card.id), gt(invoice.periodStart, now)))
      .orderBy(invoice.periodStart)
      .limit(1);

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
      params: z.object({ id: z.string().uuid() }),
      querystring: paginationSchema,
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { page, limit } = request.query;

    const [card] = await app.db.select()
      .from(creditCard)
      .where(and(eq(creditCard.id, request.params.id), eq(creditCard.userId, request.authUser!.id)))
      .limit(1);

    if (!card) {
      throw app.httpErrors.notFound('Card not found');
    }

    const plans = await app.db.select({ id: installmentPlan.id })
      .from(installmentPlan)
      .where(eq(installmentPlan.cardId, card.id));

    const planIds = plans.map(p => p.id);

    const [installments, totalResult] = await Promise.all([
      app.db.select({
        installment,
        plan: installmentPlan,
        invoice: invoice,
      })
        .from(installment)
        .leftJoin(installmentPlan, eq(installment.planId, installmentPlan.id))
        .leftJoin(invoice, eq(installment.invoiceId, invoice.id))
        .where(and(
          inArray(installment.planId, planIds),
          inArray(installment.status, ['PENDING', 'OVERDUE'])
        ))
        .orderBy(installment.dueDate)
        .limit(limit)
        .offset((page - 1) * limit),
      app.db.select({ count: count() }).from(installment)
        .where(and(
          inArray(installment.planId, planIds),
          inArray(installment.status, ['PENDING', 'OVERDUE'])
        )),
    ]);

    const total = totalResult[0]?.count || 0;

    return {
      data: installments.map((i) => ({
        ...i.installment,
        amount: { cents: Number(i.installment.amountCents), currency: 'BRL' as const },
        plan: i.plan,
        invoice: i.invoice,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.patch('/:id', {
    schema: updateCardSchema,
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [existing] = await app.db.select()
      .from(creditCard)
      .where(and(eq(creditCard.id, request.params.id), eq(creditCard.userId, request.authUser!.id)))
      .limit(1);

    if (!existing) {
      throw app.httpErrors.notFound('Card not found');
    }

    if (request.body.accountId) {
      const [account] = await app.db.select()
        .from(bankAccount)
        .where(and(eq(bankAccount.id, request.body.accountId), eq(bankAccount.userId, request.authUser!.id)))
        .limit(1);
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

    const [card] = await app.db.update(creditCard)
      .set(updateData)
      .where(eq(creditCard.id, request.params.id))
      .returning();

    const [cardWithAccount] = await app.db.select({
      creditCard,
      account: bankAccount,
    })
      .from(creditCard)
      .leftJoin(bankAccount, eq(creditCard.accountId, bankAccount.id))
      .where(eq(creditCard.id, card.id))
      .limit(1);

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
      ...cardWithAccount!.creditCard,
      account: cardWithAccount!.account,
      limit: { cents: Number(cardWithAccount!.creditCard.limitCents), currency: 'BRL' as const },
      availableLimit: { cents: Number(cardWithAccount!.creditCard.availableLimitCents), currency: 'BRL' as const },
    };
  });

  app.delete('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
const [existing] = await app.db.select()
      .from(creditCard)
      .where(and(eq(creditCard.id, request.params.id), eq(creditCard.userId, request.authUser!.id)))
      .limit(1);

    if (!existing) {
      throw app.httpErrors.notFound('Card not found');
    }

    const [cardInvoices, cardPlans, cardTransactions] = await Promise.all([
      app.db.select().from(invoice).where(eq(invoice.cardId, request.params.id)).limit(1),
      app.db.select().from(installmentPlan).where(eq(installmentPlan.cardId, request.params.id)).limit(1),
      app.db.select().from(transaction).where(and(eq(transaction.cardId, request.params.id), eq(transaction.userId, request.authUser!.id))).limit(1),
    ]);

    if (cardInvoices.length > 0 || cardPlans.length > 0 || cardTransactions.length > 0) {
      throw app.httpErrors.conflict('Não é possível excluir este cartão porque existem faturas, parcelas ou transações vinculadas a ele.');
    }

    await app.db.delete(creditCard).where(eq(creditCard.id, request.params.id));

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'CARD_DELETED',
      entityType: 'CreditCard',
      entityId: request.params.id,
      oldData: existing,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });
};

export default cardsRoutes;