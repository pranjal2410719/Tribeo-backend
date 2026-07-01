import { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../../shared/errors/app-error';

export async function removeMember(request: FastifyRequest, reply: FastifyReply) {
  const { slug, userId } = request.params as { slug: string; userId: string };
  const prisma = (request.server as any).prisma;

  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) throw new AppError(404, 'Community not found');

  const membership = await prisma.membership.findUnique({
    where: { communityId_userId: { communityId: community.id, userId } },
  });
  if (!membership) throw new AppError(404, 'Member not found');

  await prisma.membership.delete({
    where: { communityId_userId: { communityId: community.id, userId } },
  });

  return reply.send({ message: 'Member removed' });
}

export async function banUser(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };
  const { userId, reason } = request.body as { userId: string; reason?: string };
  const prisma = (request.server as any).prisma;

  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) throw new AppError(404, 'Community not found');

  const existingBan = await prisma.banRecord.findUnique({
    where: { userId_communityId: { userId, communityId: community.id } },
  });
  if (existingBan) throw new AppError(409, 'User is already banned');

  await prisma.banRecord.create({
    data: { userId, communityId: community.id, reason, bannedById: request.user!.id },
  });

  await prisma.membership.updateMany({
    where: { communityId: community.id, userId },
    data: { status: 'BANNED' },
  });

  return reply.send({ message: 'User banned' });
}

export async function unbanUser(request: FastifyRequest, reply: FastifyReply) {
  const { slug, userId } = request.params as { slug: string; userId: string };
  const prisma = (request.server as any).prisma;

  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) throw new AppError(404, 'Community not found');

  await prisma.banRecord.deleteMany({
    where: { userId, communityId: community.id },
  });

  await prisma.membership.updateMany({
    where: { communityId: community.id, userId, status: 'BANNED' },
    data: { status: 'APPROVED' },
  });

  return reply.send({ message: 'User unbanned' });
}

export async function promoteToModerator(request: FastifyRequest, reply: FastifyReply) {
  const { slug, userId } = request.params as { slug: string; userId: string };
  const prisma = (request.server as any).prisma;

  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) throw new AppError(404, 'Community not found');

  const membership = await prisma.membership.findUnique({
    where: { communityId_userId: { communityId: community.id, userId } },
  });
  if (!membership || membership.status !== 'APPROVED') {
    throw new AppError(404, 'Approved member not found');
  }

  const updated = await prisma.membership.update({
    where: { communityId_userId: { communityId: community.id, userId } },
    data: { role: 'MODERATOR' },
  });

  return reply.send({ membership: updated });
}

export async function demoteModerator(request: FastifyRequest, reply: FastifyReply) {
  const { slug, userId } = request.params as { slug: string; userId: string };
  const prisma = (request.server as any).prisma;

  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) throw new AppError(404, 'Community not found');

  const membership = await prisma.membership.findUnique({
    where: { communityId_userId: { communityId: community.id, userId } },
  });
  if (!membership) throw new AppError(404, 'Member not found');

  if (community.ownerId === userId) {
    throw new AppError(400, 'Cannot demote the community owner');
  }

  const updated = await prisma.membership.update({
    where: { communityId_userId: { communityId: community.id, userId } },
    data: { role: 'MEMBER' },
  });

  return reply.send({ membership: updated });
}
