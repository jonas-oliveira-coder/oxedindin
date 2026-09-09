import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { user } from '../../db/schema';

const settingsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userData = request.authUser!;
    const settings = (userData.settings as Record<string, unknown>) || {};

    return {
      theme: settings.theme || 'system',
      language: settings.language || 'pt-BR',
      currency: settings.currency || 'BRL',
      dateFormat: settings.dateFormat || 'DD/MM/YYYY',
      firstDayOfWeek: settings.firstDayOfWeek ?? 0,
      defaultAccountId: settings.defaultAccountId,
      defaultCardId: settings.defaultCardId,
      dashboardLayout: settings.dashboardLayout || [],
    };
  });

  app.patch('/', {
    schema: {
      body: z.object({
        theme: z.enum(['light', 'dark', 'system']).optional(),
        language: z.literal('pt-BR').optional(),
        currency: z.literal('BRL').optional(),
        dateFormat: z.string().optional(),
        firstDayOfWeek: z.enum(['0', '1']).optional(),
        defaultAccountId: z.string().cuid().nullable().optional(),
        defaultCardId: z.string().cuid().nullable().optional(),
        dashboardLayout: z.array(z.string()).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userData = request.authUser!;
    const currentSettings = (userData.settings as Record<string, unknown>) || {};
    const newSettings = { ...currentSettings, ...request.body };

    await app.db.update(user)
      .set({ settings: newSettings })
      .where(eq(user.id, userData.id));

    return {
      theme: newSettings.theme || 'system',
      language: newSettings.language || 'pt-BR',
      currency: newSettings.currency || 'BRL',
      dateFormat: newSettings.dateFormat || 'DD/MM/YYYY',
      firstDayOfWeek: newSettings.firstDayOfWeek ?? 0,
      defaultAccountId: newSettings.defaultAccountId,
      defaultCardId: newSettings.defaultCardId,
      dashboardLayout: newSettings.dashboardLayout || [],
    };
  });
};

export default settingsRoutes;