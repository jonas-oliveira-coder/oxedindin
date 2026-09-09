import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

const settingsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = request.authUser!;
    const settings = (user.settings as any) || {};

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
        firstDayOfWeek: z.enum([0, 1]).optional(),
        defaultAccountId: z.string().cuid().nullable().optional(),
        defaultCardId: z.string().cuid().nullable().optional(),
        dashboardLayout: z.array(z.string()).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = request.authUser!;
    const currentSettings = (user.settings as any) || {};
    const newSettings = { ...currentSettings, ...request.body };

    await app.prisma.user.update({
      where: { id: user.id },
      data: { settings: newSettings },
    });

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