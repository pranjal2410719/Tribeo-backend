import { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../../shared/errors/app-error';

export async function joinCommunity(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user!;
  const { slug } = request.params as { slug: string };
  const prisma = (request.server as any).prisma;

  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) throw new AppError(404, 'Community not found');

  const existing = await prisma.membership.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: user.id } },
  });
  if (existing) throw new AppError(409, 'Already a member or request pending');

  const status = community.visibility === 'PUBLIC' ? 'APPROVED' : 'PENDING';

  const membership = await prisma.membership.create({
    data: { communityId: community.id, userId: user.id, status },
  });

  return reply.status(201).send({ membership });
}

export async function leaveCommunity(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user!;
  const { slug } = request.params as { slug: string };
  const prisma = (request.server as any).prisma;

  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) throw new AppError(404, 'Community not found');

  const membership = await prisma.membership.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: user.id } },
  });
  if (!membership) throw new AppError(404, 'Not a member');

  await prisma.membership.delete({
    where: { communityId_userId: { communityId: community.id, userId: user.id } },
  });

  return reply.send({ message: 'Left community' });
}

export async function listMembers(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };
  const prisma = (request.server as any).prisma;

  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) throw new AppError(404, 'Community not found');

  const members = await prisma.membership.findMany({
    where: { communityId: community.id, status: 'APPROVED' },
    include: { user: { select: { id: true, email: true }, include: { profile: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return reply.send({ members });
}

export async function listPendingRequests(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };
  const prisma = (request.server as any).prisma;

  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) throw new AppError(404, 'Community not found');

  const requests = await prisma.membership.findMany({
    where: { communityId: community.id, status: 'PENDING' },
    include: { user: { select: { id: true, email: true }, include: { profile: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return reply.send({ requests });
}

export async function approveRequest(request: FastifyRequest, reply: FastifyReply) {
  const { slug, userId } = request.params as { slug: string; userId: string };
  const prisma = (request.server as any).prisma;

  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) throw new AppError(404, 'Community not found');

  const membership = await prisma.membership.findUnique({
    where: { communityId_userId: { communityId: community.id, userId } },
  });
  if (!membership || membership.status !== 'PENDING') {
    throw new AppError(404, 'No pending request found');
  }

  const updated = await prisma.membership.update({
    where: { communityId_userId: { communityId: community.id, userId } },
    data: { status: 'APPROVED' },
  });

  return reply.send({ membership: updated });
}

export async function rejectRequest(request: FastifyRequest, reply: FastifyReply) {
  const { slug, userId } = request.params as { slug: string; userId: string };
  const prisma = (request.server as any).prisma;

  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) throw new AppError(404, 'Community not found');

  const membership = await prisma.membership.findUnique({
    where: { communityId_userId: { communityId: community.id, userId } },
  });
  if (!membership || membership.status !== 'PENDING') {
    throw new AppError(404, 'No pending request found');
  }

  await prisma.membership.delete({
    where: { communityId_userId: { communityId: community.id, userId } },
  });

  return reply.send({ message: 'Request rejected' });
}
