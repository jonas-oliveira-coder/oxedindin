import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createCategorySchema, paginationSchema } from '../../types/schemas.js';

const defaultCategories = [
  { name: 'Alimentação', icon: '🍔', color: '#EF4444' },
  { name: 'Transporte', icon: '🚌', color: '#3B82F6' },
  { name: 'Moradia', icon: '🏠', color: '#8B5CF6' },
  { name: 'Saúde', icon: '🏥', color: '#EC4899' },
  { name: 'Educação', icon: '📚', color: '#06B6D4' },
  { name: 'Lazer', icon: '🎮', color: '#F59E0B' },
  { name: 'Assinaturas', icon: '📱', color: '#84CC16' },
  { name: 'Compras', icon: '🛍️', color: '#F97316' },
  { name: 'Serviços', icon: '🔧', color: '#6366F1' },
  { name: 'Contas', icon: '📄', color: '#14B8A6' },
  { name: 'Dívidas', icon: '💳', color: '#DC2626' },
  { name: 'Outros', icon: '📦', color: '#6B7280' },
];

const categoriesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    schema: {
      querystring: paginationSchema,
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { page, limit } = request.query;
    const userId = request.authUser!.id;

    const [categories, total] = await Promise.all([
      app.prisma.category.findMany({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      app.prisma.category.count({ where: { userId } }),
    ]);

    return {
      data: categories,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.post('/', {
    schema: createCategorySchema,
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const category = await app.prisma.category.create({
      data: {
        ...request.body,
        userId: request.authUser!.id,
        isDefault: false,
      },
    });

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'CATEGORY_CREATED',
      entityType: 'Category',
      entityId: category.id,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send(category);
  });

  app.patch('/:id', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
      body: z.object({
        name: z.string().min(1).max(50).optional(),
        icon: z.string().max(50).nullable().optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const existing = await app.prisma.category.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
    });

    if (!existing) {
      throw app.httpErrors.notFound('Category not found');
    }

    if (existing.isDefault) {
      throw app.httpErrors.forbidden('Cannot modify default category');
    }

    const category = await app.prisma.category.update({
      where: { id: request.params.id },
      data: request.body,
    });

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'CATEGORY_UPDATED',
      entityType: 'Category',
      entityId: category.id,
      oldData: existing,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return category;
  });

  app.delete('/:id', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const existing = await app.prisma.category.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
    });

    if (!existing) {
      throw app.httpErrors.notFound('Category not found');
    }

    if (existing.isDefault) {
      throw app.httpErrors.forbidden('Cannot delete default category');
    }

    await app.prisma.category.delete({ where: { id: request.params.id } });

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'CATEGORY_DELETED',
      entityType: 'Category',
      entityId: request.params.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });

  app.post('/initialize-defaults', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const existingDefaults = await app.prisma.category.findMany({
      where: { userId: request.authUser!.id, isDefault: true },
    });

    if (existingDefaults.length > 0) {
      return { message: 'Default categories already initialized', count: existingDefaults.length };
    }

    const categories = await app.prisma.category.createMany({
      data: defaultCategories.map((c) => ({
        ...c,
        userId: request.authUser!.id,
        isDefault: true,
      })),
      skipDuplicates: true,
    });

    return { message: 'Default categories initialized', count: categories.count };
  });
};

export default categoriesRoutes;