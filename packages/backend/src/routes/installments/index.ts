import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq, and, gte, lte, asc, count, sql, inArray, desc } from 'drizzle-orm';
import { paginationSchema } from '../../types/schemas.js';
import { installment, installmentPlan, creditCard, invoice, bankAccount, transaction, category } from '../../db/schema/index.js';

const installmentsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    schema: {
      querystring: paginationSchema.merge(z.object({
        cardId: z.string().uuid().optional(),
        status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
      })),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { page, limit, cardId, status } = request.query;
    const userId = request.authUser!.id;

    const cardConditions = [eq(creditCard.userId, userId)];
    if (cardId) cardConditions.push(eq(creditCard.id, cardId));
    const cardIds = await app.db.select({ id: creditCard.id })
      .from(creditCard)
      .where(and(...cardConditions));

    const cardIdArray = cardIds.map(c => c.id);

    const conditions = [inArray(installmentPlan.cardId, cardIdArray)];
    if (status) conditions.push(eq(installment.status, status));

    const [installmentsData, totalResult] = await Promise.all([
      app.db.select({
        installment,
        plan: installmentPlan,
        invoice: invoice,
      })
        .from(installment)
        .leftJoin(installmentPlan, eq(installment.planId, installmentPlan.id))
        .leftJoin(invoice, eq(installment.invoiceId, invoice.id))
        .where(and(...conditions))
        .orderBy(asc(installment.dueDate))
        .limit(limit)
        .offset((page - 1) * limit),
      app.db.select({ count: count() })
        .from(installment)
        .leftJoin(installmentPlan, eq(installment.planId, installmentPlan.id))
        .where(and(...conditions)),
    ]);

    const total = totalResult[0]?.count || 0;

    return {
      data: installmentsData.map((i) => ({
        ...i.installment,
        amount: { cents: Number(i.installment.amountCents), currency: 'BRL' as const },
        plan: i.plan,
        invoice: i.invoice,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.get('/upcoming', {
    schema: {
      querystring: z.object({
        months: z.coerce.number().int().positive().max(24).default(6),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { months } = request.query;
    const userId = request.authUser!.id;
    const now = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);

    const cardIds = await app.db.select({ id: creditCard.id })
      .from(creditCard)
      .where(eq(creditCard.userId, userId));
    const cardIdArray = cardIds.map(c => c.id);

    const planIds = await app.db.select({ id: installmentPlan.id })
      .from(installmentPlan)
      .where(inArray(installmentPlan.cardId, cardIdArray));
    const planIdArray = planIds.map(p => p.id);

    const installmentsData = await app.db.select({
      installment,
      plan: installmentPlan,
      invoice: invoice,
    })
      .from(installment)
      .leftJoin(installmentPlan, eq(installment.planId, installmentPlan.id))
      .leftJoin(creditCard, eq(installmentPlan.cardId, creditCard.id))
      .leftJoin(invoice, eq(installment.invoiceId, invoice.id))
      .where(and(
        inArray(installment.planId, planIdArray),
        inArray(installment.status, ['PENDING', 'OVERDUE']),
        gte(installment.dueDate, now),
        lte(installment.dueDate, endDate)
      ))
      .orderBy(asc(installment.dueDate));

    return installmentsData.map((i) => ({
      ...i.installment,
      amount: { cents: Number(i.installment.amountCents), currency: 'BRL' as const },
      plan: i.plan,
      invoice: i.invoice,
    }));
  });

  app.get('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [plan] = await app.db.select()
      .from(installmentPlan)
      .where(and(eq(installmentPlan.id, request.params.id), eq(installmentPlan.userId, request.authUser!.id)))
      .limit(1);

    if (!plan) {
      throw app.httpErrors.notFound('Parcelamento não encontrado.');
    }

    const planWithCard = await app.db.select({
      installmentPlan,
      card: creditCard,
      category: category,
    })
      .from(installmentPlan)
      .leftJoin(creditCard, eq(installmentPlan.cardId, creditCard.id))
      .leftJoin(category, eq(installmentPlan.categoryId, category.id))
      .where(eq(installmentPlan.id, plan.id))
      .limit(1);

    const installmentsData = await app.db.select({
      installment,
      invoice: invoice,
    })
      .from(installment)
      .leftJoin(invoice, eq(installment.invoiceId, invoice.id))
      .where(eq(installment.planId, plan.id))
      .orderBy(asc(installment.number));

    return {
      ...planWithCard[0].installmentPlan,
      card: planWithCard[0].card,
      category: planWithCard[0].category,
      totalAmount: { cents: Number(planWithCard[0].installmentPlan.totalAmountCents), currency: 'BRL' as const },
      installmentValue: { cents: Number(planWithCard[0].installmentPlan.installmentValueCents), currency: 'BRL' as const },
      installments: installmentsData.map((i) => ({
        ...i.installment,
        amount: { cents: Number(i.installment.amountCents), currency: 'BRL' as const },
        invoice: i.invoice,
      })),
    };
  });

  app.patch('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        description: z.string().min(1).max(200).optional(),
        categoryId: z.string().uuid().nullable().optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [existing] = await app.db.select()
      .from(installmentPlan)
      .where(and(eq(installmentPlan.id, request.params.id), eq(installmentPlan.userId, request.authUser!.id)))
      .limit(1);

    if (!existing) {
      throw app.httpErrors.notFound('Parcelamento não encontrado.');
    }

    const [updatedPlan] = await app.db.update(installmentPlan)
      .set(request.body)
      .where(eq(installmentPlan.id, request.params.id))
      .returning();

    const [planWithRelations] = await app.db.select({
      installmentPlan,
      card: creditCard,
      category: category,
    })
      .from(installmentPlan)
      .leftJoin(creditCard, eq(installmentPlan.cardId, creditCard.id))
      .leftJoin(category, eq(installmentPlan.categoryId, category.id))
      .where(eq(installmentPlan.id, updatedPlan.id))
      .limit(1);

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'INSTALLMENT_PLAN_UPDATED',
      entityType: 'InstallmentPlan',
      entityId: updatedPlan.id,
      oldData: existing,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      ...planWithRelations!.installmentPlan,
      card: planWithRelations!.card,
      category: planWithRelations!.category,
      totalAmount: { cents: Number(planWithRelations!.installmentPlan.totalAmountCents), currency: 'BRL' as const },
      installmentValue: { cents: Number(planWithRelations!.installmentPlan.installmentValueCents), currency: 'BRL' as const },
    };
  });

  app.delete('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [existing] = await app.db.select()
      .from(installmentPlan)
      .where(and(eq(installmentPlan.id, request.params.id), eq(installmentPlan.userId, request.authUser!.id)))
      .limit(1);

    if (!existing) {
      throw app.httpErrors.notFound('Parcelamento não encontrado.');
    }

    const pendingInstallments = await app.db.select()
      .from(installment)
      .where(and(
        eq(installment.planId, request.params.id),
        inArray(installment.status, ['PENDING', 'OVERDUE'])
      ));

    for (const installmentRecord of pendingInstallments) {
      if (installmentRecord.invoiceId) {
        await app.db.update(invoice)
          .set({
            totalCents: sql`${invoice.totalCents} - ${installmentRecord.amountCents}`,
            remainingCents: sql`${invoice.remainingCents} - ${installmentRecord.amountCents}`,
          })
          .where(eq(invoice.id, installmentRecord.invoiceId));
      }
    }

    const paidInstallmentsCount = await app.db.select({ count: count() })
      .from(installment)
      .where(and(
        eq(installment.planId, request.params.id),
        eq(installment.status, 'PAID')
      ));

    const remainingAmount = Number(existing.totalAmountCents) - (Number(paidInstallmentsCount[0]?.count || 0) * Number(existing.installmentValueCents));

    await app.db.update(creditCard)
      .set({ availableLimitCents: sql`${creditCard.availableLimitCents} + ${remainingAmount}` })
      .where(eq(creditCard.id, existing.cardId));

    await app.db.update(installmentPlan)
      .set({ installmentsCount: existing.installmentsCount - pendingInstallments.length })
      .where(eq(installmentPlan.id, request.params.id));

    await app.db.delete(installment)
      .where(and(
        eq(installment.planId, request.params.id),
        inArray(installment.id, pendingInstallments.map(i => i.id))
      ));

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'INSTALLMENT_PLAN_CANCELLED',
      entityType: 'InstallmentPlan',
      entityId: request.params.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true, cancelledInstallments: pendingInstallments.length };
  });

  app.post('/:planId/installments/:number/pay', {
    schema: {
      params: z.object({
        planId: z.string().uuid(),
        number: z.coerce.number().int().positive(),
      }),
      body: z.object({
        amount: z.number().int().positive().optional(),
        accountId: z.string().uuid().optional(),
        date: z.string().datetime().optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { planId, number } = request.params;
    const { amount, accountId, date } = request.body;
    const userId = request.authUser!.id;

    const [installmentRecord] = await app.db.select({
      installment,
      plan: installmentPlan,
      card: creditCard,
      invoice: invoice,
    })
      .from(installment)
      .leftJoin(installmentPlan, eq(installment.planId, installmentPlan.id))
      .leftJoin(creditCard, eq(installmentPlan.cardId, creditCard.id))
      .leftJoin(invoice, eq(installment.invoiceId, invoice.id))
      .where(and(eq(installment.planId, planId), eq(installment.number, number), eq(installmentPlan.userId, userId)))
      .limit(1);

    if (!installmentRecord) {
      throw app.httpErrors.notFound('Parcela não encontrada.');
    }

    if (installmentRecord.installment.status === 'PAID') {
      throw app.httpErrors.badRequest('Esta parcela já foi paga.');
    }

    const paymentAmount = amount || Number(installmentRecord.installment.amountCents);

    if (accountId) {
      const [account] = await app.db.select()
        .from(bankAccount)
        .where(and(eq(bankAccount.id, accountId), eq(bankAccount.userId, userId)))
        .limit(1);
      if (!account) throw app.httpErrors.badRequest('Conta não encontrada.');

      await app.db.update(bankAccount)
        .set({ balanceCents: sql`${bankAccount.balanceCents} - ${paymentAmount}` })
        .where(eq(bankAccount.id, accountId));
    }

    await app.db.update(installment)
      .set({
        status: 'PAID',
        paidAt: date ? new Date(date) : new Date(),
      })
      .where(eq(installment.id, installmentRecord.installment.id));

    if (installmentRecord.installment.invoiceId) {
      const [invoiceRecord] = await app.db.select()
        .from(invoice)
        .where(eq(invoice.id, installmentRecord.installment.invoiceId))
        .limit(1);
      if (invoiceRecord) {
        const newPaid = Number(invoiceRecord.paidCents) + paymentAmount;
        const newRemaining = Number(invoiceRecord.totalCents) - newPaid;
        const newStatus = newRemaining === 0 ? 'PAID' : newPaid > 0 ? 'PARTIALLY_PAID' : invoiceRecord.status;

        await app.db.update(invoice)
          .set({
            paidCents: BigInt(newPaid),
            remainingCents: BigInt(newRemaining),
            status: newStatus,
          })
          .where(eq(invoice.id, invoiceRecord.id));
      }
    }

    await app.db.update(creditCard)
      .set({ availableLimitCents: sql`${creditCard.availableLimitCents} + ${paymentAmount}` })
      .where(eq(creditCard.id, installmentRecord.card.id));

    await app.db.insert(transaction).values({
      userId,
      description: `Pagamento parcela ${number}/${installmentRecord.plan.installmentsCount} - ${installmentRecord.plan.description}`,
      amountCents: paymentAmount,
      type: 'EXPENSE',
      date: date ? new Date(date) : new Date(),
      paymentMethod: 'BANK_TRANSFER',
      accountId,
      cardId: installmentRecord.card.id,
      installmentPlanId: planId,
      notes: `Parcela ${number} de ${installmentRecord.plan.installmentsCount}`,
    });

    await app.auditLog({
      userId,
      action: 'INSTALLMENT_PAID',
      entityType: 'Installment',
      entityId: installmentRecord.installment.id,
      newData: { amount: paymentAmount, accountId },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });
};

export default installmentsRoutes;