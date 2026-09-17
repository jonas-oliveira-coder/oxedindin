import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq, and, or, desc, asc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  sharedDebt, debt, user, person, sharedDebtPayment, sharedDebtEvent, notification,
} from '../../db/schema/index.js';

const debtorUser = alias(user, 'sd_debtor_user');
const creditorUser = alias(user, 'sd_creditor_user');
const reportedByUser = alias(user, 'sd_pay_reported_user');
const confirmedByUser = alias(user, 'sd_pay_confirmed_user');
const actorUser = alias(user, 'sd_event_actor_user');

const PAYMENT_METHODS = ['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'PIX', 'BANK_TRANSFER', 'BOLETO', 'OTHER'] as const;

function money(cents?: number | bigint | null) {
  return { cents: Number(cents ?? 0), currency: 'BRL' as const };
}

function fmt(cents?: number | bigint | null): string {
  return (Number(cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const PUBLISHED_STATUSES = ['PENDING', 'ACCEPTED', 'PAYMENT_REPORTED', 'PAYMENT_CONFIRMED', 'PAYMENT_VERIFYING'];

function serializeSharedDebt(row: any, asRole: 'debtor' | 'creditor') {
  const counterparty = asRole === 'debtor' ? row.creditor : row.debtor;
  return {
    id: row.sharedDebt.id,
    debtId: row.sharedDebt.debtId,
    status: row.sharedDebt.status,
    amountCents: Number(row.sharedDebt.amountCents ?? 0),
    amount: money(row.sharedDebt.amountCents),
    notifiedAt: row.sharedDebt.notifiedAt,
    acceptedAt: row.sharedDebt.acceptedAt,
    rejectedAt: row.sharedDebt.rejectedAt,
    createdAt: row.sharedDebt.createdAt,
    updatedAt: row.sharedDebt.updatedAt,
    debt: row.debt ? {
      id: row.debt.id,
      description: row.debt.description,
      dueDate: row.debt.dueDate,
      type: row.debt.type,
      totalAmount: money(row.debt.totalAmountCents),
      remainingAmount: money(row.debt.remainingAmountCents),
    } : null,
    counterparty: counterparty ? {
      id: counterparty.id,
      name: counterparty.name,
      email: counterparty.email,
      avatarUrl: counterparty.avatarUrl,
    } : null,
    role: asRole,
  };
}

const sharedDebtsRoutes: FastifyPluginAsyncZod = async (app) => {
  const loadSharedDebt = async (id: string) => {
    const rows = await app.db.select({
      sharedDebt,
      debt,
      debtor: debtorUser,
      creditor: creditorUser,
      relatedPerson: person,
    })
      .from(sharedDebt)
      .leftJoin(debt, eq(sharedDebt.debtId, debt.id))
      .leftJoin(debtorUser, eq(sharedDebt.debtorUserId, debtorUser.id))
      .leftJoin(creditorUser, eq(sharedDebt.creditorUserId, creditorUser.id))
      .leftJoin(person, eq(sharedDebt.personId, person.id))
      .where(eq(sharedDebt.id, id))
      .limit(1);
    return rows[0];
  };

  const loadPayments = async (sharedDebtId: string) => {
    const rows = await app.db.select({
      payment: sharedDebtPayment,
      reportedBy: reportedByUser,
      confirmedBy: confirmedByUser,
    })
      .from(sharedDebtPayment)
      .leftJoin(reportedByUser, eq(sharedDebtPayment.reportedByUserId, reportedByUser.id))
      .leftJoin(confirmedByUser, eq(sharedDebtPayment.confirmedByUserId, confirmedByUser.id))
      .where(eq(sharedDebtPayment.sharedDebtId, sharedDebtId))
      .orderBy(desc(sharedDebtPayment.createdAt));

    return rows.map((r: any) => ({
      id: r.payment.id,
      amount: money(r.payment.amountCents),
      paymentDate: r.payment.paymentDate,
      method: r.payment.method,
      notes: r.payment.notes,
      status: r.payment.status,
      confirmedAt: r.payment.confirmedAt,
      createdAt: r.payment.createdAt,
      reportedBy: r.reportedBy ? { id: r.reportedBy.id, name: r.reportedBy.name, avatarUrl: r.reportedBy.avatarUrl } : null,
      confirmedBy: r.confirmedBy ? { id: r.confirmedBy.id, name: r.confirmedBy.name, avatarUrl: r.confirmedBy.avatarUrl } : null,
    }));
  };

  const loadEvents = async (sharedDebtId: string) => {
    const rows = await app.db.select({
      event: sharedDebtEvent,
      actor: actorUser,
    })
      .from(sharedDebtEvent)
      .leftJoin(actorUser, eq(sharedDebtEvent.actorUserId, actorUser.id))
      .where(eq(sharedDebtEvent.sharedDebtId, sharedDebtId))
      .orderBy(asc(sharedDebtEvent.createdAt));

    return rows.map((r: any) => ({
      id: r.event.id,
      type: r.event.type,
      message: r.event.message,
      amount: money(r.event.amountCents),
      createdAt: r.event.createdAt,
      actor: r.actor ? { id: r.actor.id, name: r.actor.name, avatarUrl: r.actor.avatarUrl } : null,
    }));
  };

  app.get('/', {
    schema: {
      querystring: z.object({
        role: z.enum(['debtor', 'creditor', 'all']).default('all'),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { role } = request.query;
    const userId = request.authUser!.id;

    const rows = await app.db.select({
      sharedDebt,
      debt,
      debtor: debtorUser,
      creditor: creditorUser,
    })
      .from(sharedDebt)
      .leftJoin(debt, eq(sharedDebt.debtId, debt.id))
      .leftJoin(debtorUser, eq(sharedDebt.debtorUserId, debtorUser.id))
      .leftJoin(creditorUser, eq(sharedDebt.creditorUserId, creditorUser.id))
      .where(or(eq(sharedDebt.debtorUserId, userId), eq(sharedDebt.creditorUserId, userId)))
      .orderBy(desc(sharedDebt.createdAt));

    const filtered = rows.filter((r: any) => {
      if (role === 'debtor') return r.sharedDebt.debtorUserId === userId;
      if (role === 'creditor') return r.sharedDebt.creditorUserId === userId;
      return true;
    });

    return {
      data: filtered.map((r: any) => serializeSharedDebt(r, r.sharedDebt.debtorUserId === userId ? 'debtor' : 'creditor')),
    };
  });

  app.get('/:id', {
    schema: { params: z.object({ id: z.string().uuid() }) },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const userId = request.authUser!.id;
    const row = await loadSharedDebt(request.params.id);
    if (!row) throw app.httpErrors.notFound('Dívida compartilhada não encontrada.');
    if (row.sharedDebt.debtorUserId !== userId && row.sharedDebt.creditorUserId !== userId) {
      throw app.httpErrors.notFound('Dívida compartilhada não encontrada.');
    }

    const [payments, events] = await Promise.all([
      loadPayments(row.sharedDebt.id),
      loadEvents(row.sharedDebt.id),
    ]);

    return {
      ...serializeSharedDebt(row, row.sharedDebt.debtorUserId === userId ? 'debtor' : 'creditor'),
      relatedPerson: row.relatedPerson || null,
      payments,
      history: events,
    };
  });

  app.get('/:id/history', {
    schema: { params: z.object({ id: z.string().uuid() }) },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const userId = request.authUser!.id;
    const row = await loadSharedDebt(request.params.id);
    if (!row) throw app.httpErrors.notFound('Dívida compartilhada não encontrada.');
    if (row.sharedDebt.debtorUserId !== userId && row.sharedDebt.creditorUserId !== userId) {
      throw app.httpErrors.notFound('Dívida compartilhada não encontrada.');
    }
    const events = await loadEvents(row.sharedDebt.id);
    return { data: events };
  });

  app.post('/:id/accept', {
    schema: { params: z.object({ id: z.string().uuid() }) },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const actor = request.authUser!;
    const row = await loadSharedDebt(request.params.id);
    if (!row) throw app.httpErrors.notFound('Dívida compartilhada não encontrada.');
    if (row.sharedDebt.debtorUserId !== actor.id) throw app.httpErrors.forbidden('Somente o devedor pode aceitar a dívida.');
    if (row.sharedDebt.status !== 'PENDING') throw app.httpErrors.conflict('Esta solicitação não está pendente.');

    await app.db.transaction(async (tx: any) => {
      await tx.update(sharedDebt)
        .set({ status: 'ACCEPTED', acceptedAt: new Date(), updatedAt: new Date() })
        .where(eq(sharedDebt.id, row.sharedDebt.id));

      await tx.insert(sharedDebtEvent).values({
        sharedDebtId: row.sharedDebt.id,
        type: 'ACCEPTED',
        actorUserId: actor.id,
        actorName: actor.name,
        message: `${actor.name} aceitou a dívida de ${fmt(row.sharedDebt.amountCents)}.`,
        amountCents: row.sharedDebt.amountCents,
      });

      await tx.insert(notification).values({
        userId: row.sharedDebt.creditorUserId,
        type: 'SHARED_DEBT_UPDATED',
        title: 'Solicitação aceita',
        message: `${actor.name} aceitou a dívida de ${fmt(row.sharedDebt.amountCents)}.`,
        channels: ['IN_APP'],
        relatedEntityType: 'SharedDebt',
        relatedEntityId: row.sharedDebt.id,
      });
    });

    await app.broadcast(row.sharedDebt.creditorUserId, {
      type: 'notification',
      data: { type: 'SHARED_DEBT_ACCEPTED', sharedDebtId: row.sharedDebt.id },
    });

    await app.auditLog({
      userId: actor.id,
      action: 'SHARED_DEBT_ACCEPTED',
      entityType: 'SharedDebt',
      entityId: row.sharedDebt.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });

  app.post('/:id/reject', {
    schema: { params: z.object({ id: z.string().uuid() }) },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const actor = request.authUser!;
    const row = await loadSharedDebt(request.params.id);
    if (!row) throw app.httpErrors.notFound('Dívida compartilhada não encontrada.');
    if (row.sharedDebt.debtorUserId !== actor.id) throw app.httpErrors.forbidden('Somente o devedor pode recusar a dívida.');
    if (row.sharedDebt.status !== 'PENDING') throw app.httpErrors.conflict('Esta solicitação não está pendente.');

    await app.db.transaction(async (tx: any) => {
      await tx.update(sharedDebt)
        .set({ status: 'REJECTED', rejectedAt: new Date(), updatedAt: new Date() })
        .where(eq(sharedDebt.id, row.sharedDebt.id));

      await tx.insert(sharedDebtEvent).values({
        sharedDebtId: row.sharedDebt.id,
        type: 'REJECTED',
        actorUserId: actor.id,
        actorName: actor.name,
        message: `${actor.name} recusou a atribuição da dívida de ${fmt(row.sharedDebt.amountCents)}.`,
        amountCents: row.sharedDebt.amountCents,
      });

      await tx.insert(notification).values({
        userId: row.sharedDebt.creditorUserId,
        type: 'SHARED_DEBT_UPDATED',
        title: 'Solicitação recusada',
        message: `${actor.name} recusou a atribuição da dívida de ${fmt(row.sharedDebt.amountCents)}.`,
        channels: ['IN_APP'],
        relatedEntityType: 'SharedDebt',
        relatedEntityId: row.sharedDebt.id,
      });
    });

    await app.broadcast(row.sharedDebt.creditorUserId, {
      type: 'notification',
      data: { type: 'SHARED_DEBT_REJECTED', sharedDebtId: row.sharedDebt.id },
    });

    await app.auditLog({
      userId: actor.id,
      action: 'SHARED_DEBT_REJECTED',
      entityType: 'SharedDebt',
      entityId: row.sharedDebt.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });

  app.post('/:id/cancel', {
    schema: { params: z.object({ id: z.string().uuid() }) },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const actor = request.authUser!;
    const row = await loadSharedDebt(request.params.id);
    if (!row) throw app.httpErrors.notFound('Dívida compartilhada não encontrada.');
    if (row.sharedDebt.creditorUserId !== actor.id) throw app.httpErrors.forbidden('Somente o credor pode cancelar a dívida.');
    if (!PUBLISHED_STATUSES.includes(row.sharedDebt.status)) throw app.httpErrors.conflict('Esta solicitação não pode ser cancelada.');

    await app.db.transaction(async (tx: any) => {
      await tx.update(sharedDebt)
        .set({ status: 'CANCELLED', updatedAt: new Date() })
        .where(eq(sharedDebt.id, row.sharedDebt.id));

      await tx.insert(sharedDebtEvent).values({
        sharedDebtId: row.sharedDebt.id,
        type: 'CANCELLED',
        actorUserId: actor.id,
        actorName: actor.name,
        message: `${actor.name} cancelou a dívida compartilhada.`,
      });

      await tx.insert(notification).values({
        userId: row.sharedDebt.debtorUserId,
        type: 'SHARED_DEBT_UPDATED',
        title: 'Dívida cancelada',
        message: `${actor.name} cancelou a dívida compartilhada de ${fmt(row.sharedDebt.amountCents)}.`,
        channels: ['IN_APP'],
        relatedEntityType: 'SharedDebt',
        relatedEntityId: row.sharedDebt.id,
      });
    });

    await app.broadcast(row.sharedDebt.debtorUserId, {
      type: 'notification',
      data: { type: 'SHARED_DEBT_CANCELLED', sharedDebtId: row.sharedDebt.id },
    });

    return { success: true };
  });

  app.post('/:id/pay', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        amount: z.number().int().positive(),
        paymentDate: z.string().datetime().optional(),
        method: z.enum(PAYMENT_METHODS).optional(),
        notes: z.string().max(500).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const actor = request.authUser!;
    const row = await loadSharedDebt(request.params.id);
    if (!row) throw app.httpErrors.notFound('Dívida compartilhada não encontrada.');
    if (row.sharedDebt.debtorUserId !== actor.id) throw app.httpErrors.forbidden('Somente o devedor pode informar o pagamento.');
    if (!['ACCEPTED', 'PAYMENT_VERIFYING'].includes(row.sharedDebt.status)) {
      throw app.httpErrors.conflict('Pagamento só pode ser informado após a aceitação.');
    }

    const portion = Number(row.sharedDebt.amountCents ?? 0);
    if (portion > 0 && request.body.amount > portion) {
      throw app.httpErrors.badRequest('O valor do pagamento excede a sua parte.');
    }

    const paymentDate = request.body.paymentDate ? new Date(request.body.paymentDate) : new Date();

    await app.db.transaction(async (tx: any) => {
      await tx.insert(sharedDebtPayment).values({
        sharedDebtId: row.sharedDebt.id,
        amountCents: BigInt(request.body.amount),
        paymentDate,
        method: request.body.method || null,
        notes: request.body.notes || null,
        reportedByUserId: actor.id,
        status: 'REPORTED',
      });

      await tx.update(sharedDebt)
        .set({ status: 'PAYMENT_REPORTED', updatedAt: new Date() })
        .where(eq(sharedDebt.id, row.sharedDebt.id));

      await tx.insert(sharedDebtEvent).values({
        sharedDebtId: row.sharedDebt.id,
        type: 'PAYMENT_REPORTED',
        actorUserId: actor.id,
        actorName: actor.name,
        message: `${actor.name} informou o pagamento de ${fmt(request.body.amount)}.`,
        amountCents: BigInt(request.body.amount),
      });

      await tx.insert(notification).values({
        userId: row.sharedDebt.creditorUserId,
        type: 'SHARED_DEBT_PAYMENT',
        title: 'Pagamento informado',
        message: `${actor.name} informou que pagou ${fmt(request.body.amount)}.`,
        channels: ['IN_APP'],
        relatedEntityType: 'SharedDebt',
        relatedEntityId: row.sharedDebt.id,
      });
    });

    await app.broadcast(row.sharedDebt.creditorUserId, {
      type: 'notification',
      data: { type: 'SHARED_DEBT_PAYMENT', sharedDebtId: row.sharedDebt.id },
    });

    await app.auditLog({
      userId: actor.id,
      action: 'SHARED_DEBT_PAYMENT_REPORTED',
      entityType: 'SharedDebt',
      entityId: row.sharedDebt.id,
      newData: { amount: request.body.amount },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });

  app.post('/:id/payments/:paymentId/confirm', {
    schema: { params: z.object({ id: z.string().uuid(), paymentId: z.string().uuid() }) },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const actor = request.authUser!;
    const row = await loadSharedDebt(request.params.id);
    if (!row) throw app.httpErrors.notFound('Dívida compartilhada não encontrada.');
    if (row.sharedDebt.creditorUserId !== actor.id) throw app.httpErrors.forbidden('Somente o credor pode confirmar o pagamento.');

    const [payment] = await app.db.select()
      .from(sharedDebtPayment)
      .where(and(eq(sharedDebtPayment.id, request.params.paymentId), eq(sharedDebtPayment.sharedDebtId, row.sharedDebt.id)))
      .limit(1);
    if (!payment) throw app.httpErrors.notFound('Pagamento não encontrado.');
    if (payment.status !== 'REPORTED') throw app.httpErrors.conflict('Este pagamento não está pendente de confirmação.');

    await app.db.transaction(async (tx: any) => {
      await tx.update(sharedDebtPayment)
        .set({ status: 'CONFIRMED', confirmedByUserId: actor.id, confirmedAt: new Date(), updatedAt: new Date() })
        .where(eq(sharedDebtPayment.id, payment.id));

      await tx.update(sharedDebt)
        .set({ status: 'PAYMENT_CONFIRMED', updatedAt: new Date() })
        .where(eq(sharedDebt.id, row.sharedDebt.id));

      if (row.debt) {
        const paid = Number(row.debt.paidAmountCents) + Number(payment.amountCents);
        const remaining = Number(row.debt.totalAmountCents) - paid;
        await tx.update(debt)
          .set({
            paidAmountCents: BigInt(paid),
            remainingAmountCents: BigInt(remaining),
            status: remaining <= 0 ? 'PAID' : 'ACTIVE',
            updatedAt: new Date(),
          })
          .where(eq(debt.id, row.debt.id));
      }

      await tx.insert(sharedDebtEvent).values({
        sharedDebtId: row.sharedDebt.id,
        type: 'PAYMENT_CONFIRMED',
        actorUserId: actor.id,
        actorName: actor.name,
        message: `${actor.name} confirmou o recebimento de ${fmt(payment.amountCents)}.`,
        amountCents: payment.amountCents,
      });

      await tx.insert(notification).values({
        userId: row.sharedDebt.debtorUserId,
        type: 'SHARED_DEBT_PAYMENT',
        title: 'Pagamento confirmado',
        message: `${actor.name} confirmou o recebimento de ${fmt(payment.amountCents)}.`,
        channels: ['IN_APP'],
        relatedEntityType: 'SharedDebt',
        relatedEntityId: row.sharedDebt.id,
      });
    });

    await app.broadcast(row.sharedDebt.debtorUserId, {
      type: 'notification',
      data: { type: 'SHARED_DEBT_PAYMENT_CONFIRMED', sharedDebtId: row.sharedDebt.id },
    });

    await app.auditLog({
      userId: actor.id,
      action: 'SHARED_DEBT_PAYMENT_CONFIRMED',
      entityType: 'SharedDebtPayment',
      entityId: payment.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });

  app.post('/:id/payments/:paymentId/dispute', {
    schema: { params: z.object({ id: z.string().uuid(), paymentId: z.string().uuid() }) },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const actor = request.authUser!;
    const row = await loadSharedDebt(request.params.id);
    if (!row) throw app.httpErrors.notFound('Dívida compartilhada não encontrada.');
    if (row.sharedDebt.creditorUserId !== actor.id) throw app.httpErrors.forbidden('Somente o credor pode contestar o pagamento.');

    const [payment] = await app.db.select()
      .from(sharedDebtPayment)
      .where(and(eq(sharedDebtPayment.id, request.params.paymentId), eq(sharedDebtPayment.sharedDebtId, row.sharedDebt.id)))
      .limit(1);
    if (!payment) throw app.httpErrors.notFound('Pagamento não encontrado.');
    if (payment.status !== 'REPORTED') throw app.httpErrors.conflict('Este pagamento não está pendente de confirmação.');

    await app.db.transaction(async (tx: any) => {
      await tx.update(sharedDebtPayment)
        .set({ status: 'DISPUTED', updatedAt: new Date() })
        .where(eq(sharedDebtPayment.id, payment.id));

      await tx.update(sharedDebt)
        .set({ status: 'PAYMENT_VERIFYING', updatedAt: new Date() })
        .where(eq(sharedDebt.id, row.sharedDebt.id));

      await tx.insert(sharedDebtEvent).values({
        sharedDebtId: row.sharedDebt.id,
        type: 'PAYMENT_DISPUTED',
        actorUserId: actor.id,
        actorName: actor.name,
        message: `${actor.name} informou que ainda não recebeu o pagamento de ${fmt(payment.amountCents)}.`,
        amountCents: payment.amountCents,
      });

      await tx.insert(notification).values({
        userId: row.sharedDebt.debtorUserId,
        type: 'SHARED_DEBT_UPDATED',
        title: 'Pagamento em verificação',
        message: `${actor.name} informou que ainda não recebeu o pagamento de ${fmt(payment.amountCents)}.`,
        channels: ['IN_APP'],
        relatedEntityType: 'SharedDebt',
        relatedEntityId: row.sharedDebt.id,
      });
    });

    await app.broadcast(row.sharedDebt.debtorUserId, {
      type: 'notification',
      data: { type: 'SHARED_DEBT_PAYMENT_DISPUTED', sharedDebtId: row.sharedDebt.id },
    });

    return { success: true };
  });
};

export default sharedDebtsRoutes;