import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { AppError } from '../../shared/errors/app-error';

export async function membershipsRoutes(app: FastifyInstance) {
  app.post('/:slug/join', { preHandler: [authenticate] }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const prisma = (app as any).prisma;

    const community = await prisma.community.findUnique({ where: { slug } });
    if (!community) throw new AppError(404, 'Community not found');

    const existing = await prisma.membership.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: request.user!.id } },
    });

    if (existing) {
      if (existing.status === 'APPROVED') throw new AppError(409, 'Already a member');
      if (existing.status === 'PENDING') throw new AppError(409, 'Request already pending');
      if (existing.status === 'BANNED') throw new AppError(403, 'You are banned from this community');
    }

    const membership = await prisma.membership.create({
      data: {
        communityId: community.id,
        userId: request.user!.id,
        status: community.visibility === 'PUBLIC' ? 'APPROVED' : 'PENDING',
      },
    });

    return reply.status(201).send(membership);
  });

  app.delete('/:slug/leave', { preHandler: [authenticate] }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const prisma = (app as any).prisma;

    const community = await prisma.community.findUnique({ where: { slug } });
    if (!community) throw new AppError(404, 'Community not found');

    await prisma.membership.deleteMany({
      where: { communityId: community.id, userId: request.user!.id },
    });

    return reply.status(204).send();
  });

  app.get('/:slug/members', async (request) => {
    const { slug } = request.params as { slug: string };
    const { q } = request.query as any;
    const prisma = (app as any).prisma;

    const community = await prisma.community.findUnique({ where: { slug } });
    if (!community) throw new AppError(404, 'Community not found');

    const where: any = { communityId: community.id, status: 'APPROVED' };
    if (q) {
      where.user = {
        profile: {
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { profession: { contains: q, mode: 'insensitive' } },
            { skills: { has: q } },
          ],
        },
      };
    }

    const members = await prisma.membership.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            profile: {
              select: { username: true, fullName: true, avatarUrl: true, profession: true, skills: true },
            },
          },
        },
      },
    });

    return members;
  });

  app.get('/:slug/requests', { preHandler: [authenticate] }, async (request) => {
    const { slug } = request.params as { slug: string };
    const prisma = (app as any).prisma;

    const community = await prisma.community.findUnique({ where: { slug } });
    if (!community) throw new AppError(404, 'Community not found');
    if (community.ownerId !== request.user!.id) throw new AppError(403, 'Only the owner can view requests');

    const requests = await prisma.membership.findMany({
      where: { communityId: community.id, status: 'PENDING' },
      include: {
        user: {
          select: { id: true, profile: { select: { username: true, fullName: true, avatarUrl: true } } },
        },
      },
    });

    return requests;
  });

  app.put('/:slug/requests/:userId/approve', { preHandler: [authenticate] }, async (request) => {
    const { slug, userId } = request.params as { slug: string; userId: string };
    const prisma = (app as any).prisma;

    const community = await prisma.community.findUnique({ where: { slug } });
    if (!community) throw new AppError(404, 'Community not found');
    if (community.ownerId !== request.user!.id) throw new AppError(403, 'Only the owner can approve requests');

    const membership = await prisma.membership.update({
      where: { communityId_userId: { communityId: community.id, userId } },
      data: { status: 'APPROVED' },
    });

    return membership;
  });

  app.put('/:slug/requests/:userId/reject', { preHandler: [authenticate] }, async (request) => {
    const { slug, userId } = request.params as { slug: string; userId: string };
    const prisma = (app as any).prisma;

    const community = await prisma.community.findUnique({ where: { slug } });
    if (!community) throw new AppError(404, 'Community not found');
    if (community.ownerId !== request.user!.id) throw new AppError(403, 'Only the owner can reject requests');

    await prisma.membership.deleteMany({
      where: { communityId: community.id, userId },
    });

    return { message: 'Request rejected' };
  });
}
