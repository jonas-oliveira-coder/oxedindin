import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { paginationSchema } from '../../types/schemas.js';

const installmentsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    schema: {
      querystring: paginationSchema.merge(z.object({
        cardId: z.string().cuid().optional(),
        status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
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

    const where: any = { plan: { cardId: { in: cardIds } } };
    if (status) where.status = status;

    const [installments, total] = await Promise.all([
      app.prisma.installment.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { plan: true, invoice: true },
      }),
      app.prisma.installment.count({ where }),
    ]);

    return {
      data: installments.map((i) => ({
        ...i,
        amount: { cents: Number(i.amountCents), currency: 'BRL' as const },
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
  }, async (request, reply) => {
    const { months } = request.query;
    const userId = request.authUser!.id;
    const now = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);

    const installments = await app.prisma.installment.findMany({
      where: {
        plan: { userId },
        status: { in: ['PENDING', 'OVERDUE'] },
        dueDate: { gte: now, lte: endDate },
      },
      orderBy: { dueDate: 'asc' },
      include: { plan: { include: { card: true } }, invoice: true },
    });

    return installments.map((i) => ({
      ...i,
      amount: { cents: Number(i.amountCents), currency: 'BRL' as const },
    }));
  });

  app.get('/:id', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const plan = await app.prisma.installmentPlan.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
      include: {
        card: true,
        category: true,
        installments: { include: { invoice: true }, orderBy: { number: 'asc' } },
      },
    });

    if (!plan) {
      throw app.httpErrors.notFound('Installment plan not found');
    }

    return {
      ...plan,
      totalAmount: { cents: Number(plan.totalAmountCents), currency: 'BRL' as const },
      installmentValue: { cents: Number(plan.installmentValueCents), currency: 'BRL' as const },
      installments: plan.installments.map((i) => ({
        ...i,
        amount: { cents: Number(i.amountCents), currency: 'BRL' as const },
      })),
    };
  });

  app.patch('/:id', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
      body: z.object({
        description: z.string().min(1).max(200).optional(),
        categoryId: z.string().cuid().nullable().optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const existing = await app.prisma.installmentPlan.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
    });

    if (!existing) {
      throw app.httpErrors.notFound('Installment plan not found');
    }

    const plan = await app.prisma.installmentPlan.update({
      where: { id: request.params.id },
      data: request.body,
      include: { card: true, category: true },
    });

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'INSTALLMENT_PLAN_UPDATED',
      entityType: 'InstallmentPlan',
      entityId: plan.id,
      oldData: existing,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      ...plan,
      totalAmount: { cents: Number(plan.totalAmountCents), currency: 'BRL' as const },
      installmentValue: { cents: Number(plan.installmentValueCents), currency: 'BRL' as const },
    };
  });

  app.delete('/:id', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const existing = await app.prisma.installmentPlan.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
      include: { installments: true },
    });

    if (!existing) {
      throw app.httpErrors.notFound('Installment plan not found');
    }

    const pendingInstallments = existing.installments.filter(
      (i) => i.status === 'PENDING' || i.status === 'OVERDUE'
    );

    for (const installment of pendingInstallments) {
      if (installment.invoiceId) {
        await app.prisma.invoice.update({
          where: { id: installment.invoiceId },
          data: {
            totalCents: { decrement: installment.amountCents },
            remainingCents: { decrement: installment.amountCents },
          },
        });
      }
    }

    await app.prisma.creditCard.update({
      where: { id: existing.cardId },
      data: { availableLimitCents: { increment: existing.totalAmountCents - (existing.installmentsCount - pendingInstallments.length) * existing.installmentValueCents } },
    });

    await app.prisma.installmentPlan.update({
      where: { id: request.params.id },
      data: { installmentsCount: existing.installmentsCount - pendingInstallments.length },
    });

    await app.prisma.installment.deleteMany({
      where: { planId: request.params.id, id: { in: pendingInstallments.map((i) => i.id) } },
    });

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
        planId: z.string().cuid(),
        number: z.coerce.number().int().positive(),
      }),
      body: z.object({
        amount: z.number().int().positive().optional(),
        accountId: z.string().cuid().optional(),
        date: z.string().datetime().optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { planId, number } = request.params;
    const { amount, accountId, date } = request.body;
    const userId = request.authUser!.id;

    const installment = await app.prisma.installment.findFirst({
      where: { planId, number, plan: { userId } },
      include: { plan: { include: { card: true } }, invoice: true },
    });

    if (!installment) {
      throw app.httpErrors.notFound('Installment not found');
    }

    if (installment.status === 'PAID') {
      throw app.httpErrors.badRequest('Installment already paid');
    }

    const paymentAmount = amount || Number(installment.amountCents);

    if (accountId) {
      const account = await app.prisma.bankAccount.findFirst({
        where: { id: accountId, userId },
      });
      if (!account) throw app.httpErrors.badRequest('Account not found');

      await app.prisma.bankAccount.update({
        where: { id: accountId },
        data: { balanceCents: { decrement: paymentAmount } },
      });
    }

    await app.prisma.installment.update({
      where: { id: installment.id },
      data: {
        status: 'PAID',
        paidAt: date ? new Date(date) : new Date(),
      },
    });

    if (installment.invoiceId) {
      const invoice = await app.prisma.invoice.findUnique({ where: { id: installment.invoiceId } });
      if (invoice) {
        const newPaid = Number(invoice.paidCents) + paymentAmount;
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
      }
    }

    await app.prisma.creditCard.update({
      where: { id: installment.plan.cardId },
      data: { availableLimitCents: { increment: paymentAmount } },
    });

    await app.prisma.transaction.create({
      data: {
        userId,
        description: `Pagamento parcela ${number}/${installment.plan.installmentsCount} - ${installment.plan.description}`,
        amountCents: paymentAmount,
        type: 'EXPENSE',
        date: date ? new Date(date) : new Date(),
        paymentMethod: 'BANK_TRANSFER',
        accountId,
        cardId: installment.plan.cardId,
        installmentPlanId: planId,
        notes: `Parcela ${number} de ${installment.plan.installmentsCount}`,
      },
    });

    await app.auditLog({
      userId,
      action: 'INSTALLMENT_PAID',
      entityType: 'Installment',
      entityId: installment.id,
      newData: { amount: paymentAmount, accountId },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });
};

export default installmentsRoutes;