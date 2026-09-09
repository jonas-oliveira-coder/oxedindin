import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq, and, desc, asc, count } from 'drizzle-orm';
import { createCategorySchema, paginationSchema } from '../../types/schemas.js';
import { category } from '../../db/schema';

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

    const [categories, totalResult] = await Promise.all([
      app.db.select().from(category)
        .where(eq(category.userId, userId))
        .orderBy(desc(category.isDefault), asc(category.name))
        .limit(limit)
        .offset((page - 1) * limit),
      app.db.select({ count: count() }).from(category).where(eq(category.userId, userId)),
    ]);

    const total = totalResult[0]?.count || 0;

    return {
      data: categories,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.post('/', {
    schema: createCategorySchema,
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const [newCategory] = await app.db.insert(category).values({
      ...request.body,
      userId: request.authUser!.id,
      isDefault: false,
    }).returning();

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'CATEGORY_CREATED',
      entityType: 'Category',
      entityId: newCategory.id,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send(newCategory);
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
    const [existing] = await app.db.select()
      .from(category)
      .where(and(eq(category.id, request.params.id), eq(category.userId, request.authUser!.id)))
      .limit(1);

    if (!existing) {
      throw app.httpErrors.notFound('Category not found');
    }

    if (existing.isDefault) {
      throw app.httpErrors.forbidden('Cannot modify default category');
    }

    const [updatedCategory] = await app.db.update(category)
      .set(request.body)
      .where(eq(category.id, request.params.id))
      .returning();

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'CATEGORY_UPDATED',
      entityType: 'Category',
      entityId: updatedCategory.id,
      oldData: existing,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return updatedCategory;
  });

  app.delete('/:id', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const [existing] = await app.db.select()
      .from(category)
      .where(and(eq(category.id, request.params.id), eq(category.userId, request.authUser!.id)))
      .limit(1);

    if (!existing) {
      throw app.httpErrors.notFound('Category not found');
    }

    if (existing.isDefault) {
      throw app.httpErrors.forbidden('Cannot delete default category');
    }

    await app.db.delete(category).where(eq(category.id, request.params.id));

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
    const existingDefaults = await app.db.select()
      .from(category)
      .where(and(eq(category.userId, request.authUser!.id), eq(category.isDefault, true)));

    if (existingDefaults.length > 0) {
      return { message: 'Default categories already initialized', count: existingDefaults.length };
    }

    const categoriesToInsert = defaultCategories.map((c) => ({
      ...c,
      userId: request.authUser!.id,
      isDefault: true,
    }));

    await app.db.insert(category).values(categoriesToInsert).onConflictDoNothing();

    const created = await app.db.select()
      .from(category)
      .where(and(eq(category.userId, request.authUser!.id), eq(category.isDefault, true)));

    return { message: 'Default categories initialized', count: created.length };
  });
};

export default categoriesRoutes;