import { FastifyRequest, FastifyReply } from 'fastify';
import { getPaginationParams, buildPaginationMeta } from '../../shared/utils/pagination';

export async function searchCommunities(request: FastifyRequest, reply: FastifyReply) {
  const prisma = (request.server as any).prisma;
  const { q, category, tags, page, limit } = request.query as any;
  const { page: p, limit: l, offset } = getPaginationParams(page, limit);

  const where: any = {};
  if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }];
  if (category) where.category = category;
  if (tags) where.tags = { hasSome: tags.split(',') };

  const [communities, total] = await Promise.all([
    prisma.community.findMany({
      where,
      include: { owner: { select: { id: true, email: true } }, _count: { select: { memberships: true } } },
      skip: offset,
      take: l,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.community.count({ where }),
  ]);

  return reply.send({ communities, pagination: buildPaginationMeta(p, l, total) });
}

export async function searchPeople(request: FastifyRequest, reply: FastifyReply) {
  const prisma = (request.server as any).prisma;
  const { q, skills, page, limit } = request.query as any;
  const { page: p, limit: l, offset } = getPaginationParams(page, limit);

  const where: any = { isActive: true };
  if (q) {
    where.OR = [
      { username: { contains: q, mode: 'insensitive' } },
      { bio: { contains: q, mode: 'insensitive' } },
      { profession: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (skills) where.skills = { hasSome: skills.split(',') };

  const [profiles, total] = await Promise.all([
    prisma.profile.findMany({
      where,
      include: { user: { select: { id: true, email: true } } },
      skip: offset,
      take: l,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.profile.count({ where }),
  ]);

  return reply.send({ profiles, pagination: buildPaginationMeta(p, l, total) });
}
