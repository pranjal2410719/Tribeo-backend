import { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../../shared/errors/app-error';
import { generateSlug } from '../../shared/utils/slug';
import { getPaginationParams, buildPaginationMeta } from '../../shared/utils/pagination';

export async function listCommunities(request: FastifyRequest, reply: FastifyReply) {
  const prisma = (request.server as any).prisma;
  const { q, category, tags, page, limit } = request.query as any;
  const { page: p, limit: l, offset } = getPaginationParams(page, limit);

  const where: any = {};
  if (q) where.name = { contains: q, mode: 'insensitive' };
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

export async function createCommunity(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user!;
  const prisma = (request.server as any).prisma;
  const body = request.body as any;

  const slug = generateSlug(body.name);

  const existing = await prisma.community.findUnique({ where: { slug } });
  if (existing) {
    throw new AppError(409, 'A community with this name already exists');
  }

  const community = await prisma.community.create({
    data: {
      name: body.name,
      slug,
      description: body.description,
      category: body.category,
      tags: body.tags || [],
      rules: body.rules,
      visibility: body.visibility || 'PUBLIC',
      ownerId: user.id,
    },
  });

  await prisma.membership.create({
    data: {
      communityId: community.id,
      userId: user.id,
      role: 'MODERATOR',
      status: 'APPROVED',
    },
  });

  return reply.status(201).send({ community });
}

export async function getCommunity(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };
  const prisma = (request.server as any).prisma;

  const community = await prisma.community.findUnique({
    where: { slug },
    include: {
      owner: { select: { id: true, email: true } },
      _count: { select: { memberships: true } },
    },
  });

  if (!community) {
    throw new AppError(404, 'Community not found');
  }

  return reply.send({ community });
}

export async function updateCommunity(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };
  const prisma = (request.server as any).prisma;
  const body = request.body as any;

  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) {
    throw new AppError(404, 'Community not found');
  }

  const updated = await prisma.community.update({
    where: { slug },
    data: {
      name: body.name,
      description: body.description,
      logo: body.logo,
      banner: body.banner,
      category: body.category,
      tags: body.tags,
      rules: body.rules,
      visibility: body.visibility,
    },
  });

  return reply.send({ community: updated });
}

export async function deleteCommunity(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };
  const prisma = (request.server as any).prisma;

  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) {
    throw new AppError(404, 'Community not found');
  }

  await prisma.community.delete({ where: { slug } });

  return reply.send({ message: 'Community deleted' });
}
