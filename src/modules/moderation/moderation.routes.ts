import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { AppError } from '../../shared/errors/app-error';

const banSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export async function moderationRoutes(app: FastifyInstance) {
  app.delete('/:slug/members/:userId', { preHandler: [authenticate, authorize('moderator')] }, async (request, reply) => {
    const { slug, userId } = request.params as { slug: string; userId: string };
    const prisma = (app as any).prisma;

    const community = await prisma.community.findUnique({ where: { slug } });
    if (!community) throw new AppError(404, 'Community not found');
    if (userId === community.ownerId) throw new AppError(400, 'Cannot remove the owner');

    await prisma.membership.deleteMany({
      where: { communityId: community.id, userId },
    });

    return reply.status(204).send();
  });

  app.post('/:slug/ban', { preHandler: [authenticate, authorize('moderator')] }, async (request) => {
    const { slug } = request.params as { slug: string };
    const body = banSchema.parse(request.body);
    const prisma = (app as any).prisma;

    const community = await prisma.community.findUnique({ where: { slug } });
    if (!community) throw new AppError(404, 'Community not found');
    if (body.userId === community.ownerId) throw new AppError(400, 'Cannot ban the owner');

    await prisma.membership.upsert({
      where: { communityId_userId: { communityId: community.id, userId: body.userId } },
      create: { communityId: community.id, userId: body.userId, status: 'BANNED', role: 'MEMBER' },
      update: { status: 'BANNED' },
    });

    await prisma.banRecord.create({
      data: {
        userId: body.userId,
        communityId: community.id,
        reason: body.reason,
        bannedById: request.user!.id,
      },
    });

    return { message: 'User banned' };
  });

  app.delete('/:slug/ban/:userId', { preHandler: [authenticate, authorize('moderator')] }, async (request) => {
    const { slug, userId } = request.params as { slug: string; userId: string };
    const prisma = (app as any).prisma;

    const community = await prisma.community.findUnique({ where: { slug } });
    if (!community) throw new AppError(404, 'Community not found');

    await prisma.banRecord.deleteMany({
      where: { userId, communityId: community.id },
    });

    await prisma.membership.deleteMany({
      where: { userId, communityId: community.id, status: 'BANNED' },
    });

    return { message: 'User unbanned' };
  });

  app.put('/:slug/moderators/:userId', { preHandler: [authenticate, authorize('owner')] }, async (request) => {
    const { slug, userId } = request.params as { slug: string; userId: string };
    const prisma = (app as any).prisma;

    const community = await prisma.community.findUnique({ where: { slug } });
    if (!community) throw new AppError(404, 'Community not found');

    const membership = await prisma.membership.update({
      where: { communityId_userId: { communityId: community.id, userId } },
      data: { role: 'MODERATOR' },
    });

    return membership;
  });

  app.delete('/:slug/moderators/:userId', { preHandler: [authenticate, authorize('owner')] }, async (request) => {
    const { slug, userId } = request.params as { slug: string; userId: string };
    const prisma = (app as any).prisma;

    const community = await prisma.community.findUnique({ where: { slug } });
    if (!community) throw new AppError(404, 'Community not found');

    const membership = await prisma.membership.update({
      where: { communityId_userId: { communityId: community.id, userId } },
      data: { role: 'MEMBER' },
    });

    return membership;
  });
}
