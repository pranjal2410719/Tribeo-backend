import { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../shared/errors/app-error';

type Role = 'owner' | 'moderator' | 'member';

export function authorize(requiredRole: Role) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      throw new AppError(401, 'Authentication required');
    }

    const slug = (request.params as Record<string, string>).slug;
    if (!slug) {
      throw new AppError(400, 'Community slug is required');
    }

    const community = await (request.server as any).prisma.community.findUnique({
      where: { slug },
      select: { id: true, ownerId: true },
    });

    if (!community) {
      throw new AppError(404, 'Community not found');
    }

    if (requiredRole === 'owner') {
      if (community.ownerId !== user.id) {
        throw new AppError(403, 'Only the community owner can perform this action');
      }
      return;
    }

    const membership = await (request.server as any).prisma.membership.findUnique({
      where: {
        communityId_userId: {
          communityId: community.id,
          userId: user.id,
        },
      },
      select: { role: true, status: true },
    });

    if (!membership || membership.status !== 'APPROVED') {
      throw new AppError(403, 'You are not a member of this community');
    }

    if (requiredRole === 'moderator') {
      if (membership.role !== 'MODERATOR' && community.ownerId !== user.id) {
        throw new AppError(403, 'Only moderators or the owner can perform this action');
      }
    }
  };
}
