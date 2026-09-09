import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createPersonSchema, paginationSchema } from '../../types/schemas.js';

const peopleRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    schema: { querystring: paginationSchema },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { page, limit } = request.query;
    const userId = request.authUser!.id;

    const [people, total] = await Promise.all([
      app.prisma.person.findMany({
        where: { userId },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      app.prisma.person.count({ where: { userId } }),
    ]);

    return {
      data: people,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.post('/', {
    schema: createPersonSchema,
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    if (request.body.email) {
      const existing = await app.prisma.person.findFirst({
        where: { userId: request.authUser!.id, email: request.body.email },
      });
      if (existing) throw app.httpErrors.conflict('Person with this email already exists');
    }

    const person = await app.prisma.person.create({
      data: { ...request.body, userId: request.authUser!.id },
    });

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'PERSON_CREATED',
      entityType: 'Person',
      entityId: person.id,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send(person);
  });

  app.get('/:id', {
    schema: { params: z.object({ id: z.string().cuid() }) },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const person = await app.prisma.person.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
      include: {
        debts: { include: { sharedDebts: true } },
        sharedDebts: { include: { debt: true, creditor: true } },
      },
    });

    if (!person) throw app.httpErrors.notFound('Person not found');

    return person;
  });

  app.patch('/:id', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
      body: z.object({
        name: z.string().min(1).max(100).optional(),
        email: z.string().email().nullable().optional(),
        type: z.enum(['INDIVIDUAL', 'COMPANY']).optional(),
        phone: z.string().max(20).nullable().optional(),
        document: z.string().max(20).nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const existing = await app.prisma.person.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
    });
    if (!existing) throw app.httpErrors.notFound('Person not found');

    if (request.body.email && request.body.email !== existing.email) {
      const duplicate = await app.prisma.person.findFirst({
        where: { userId: request.authUser!.id, email: request.body.email },
      });
      if (duplicate) throw app.httpErrors.conflict('Person with this email already exists');
    }

    const person = await app.prisma.person.update({
      where: { id: request.params.id },
      data: request.body,
    });

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'PERSON_UPDATED',
      entityType: 'Person',
      entityId: person.id,
      oldData: existing,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return person;
  });

  app.delete('/:id', {
    schema: { params: z.object({ id: z.string().cuid() }) },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    await app.prisma.person.delete({ where: { id: request.params.id } });

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'PERSON_DELETED',
      entityType: 'Person',
      entityId: request.params.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });
};

export default peopleRoutes;