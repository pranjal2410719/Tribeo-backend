import { FastifyInstance } from 'fastify';

export async function adminRoutes(app: FastifyInstance) {
  app.get('/stats', async (request, reply) => {
    const prisma = (app as any).prisma;

    const [users, communities, memberships] = await Promise.all([
      prisma.user.count(),
      prisma.community.count(),
      prisma.membership.count({ where: { status: 'APPROVED' } }),
    ]);

    return { users, communities, memberships };
  });
}
