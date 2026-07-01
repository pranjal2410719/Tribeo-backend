import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';

export async function usersRoutes(app: FastifyInstance) {
  app.get('/me', { preHandler: [authenticate] }, async (request) => {
    const prisma = (app as any).prisma;

    const user = await prisma.user.findUnique({
      where: { id: request.user!.id },
      include: {
        profile: true,
        _count: { select: { memberships: true, ownedCommunities: true } },
      },
    });

    return user;
  });
}
