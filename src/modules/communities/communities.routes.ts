import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { AppError } from '../../shared/errors/app-error';
import { getPaginationParams, buildPaginationMeta } from '../../shared/utils/pagination';
import { generateSlug } from '../../shared/utils/slug';

const createCommunitySchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(2000).optional(),
  logo: z.string().url().optional(),
  banner: z.string().url().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  rules: z.string().max(5000).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
});

const updateCommunitySchema = createCommunitySchema.partial();

export async function communitiesRoutes(app: FastifyInstance) {
  app.get('/', async (request) => {
    const { page, limit, q, category } = request.query as any;
    const { page: p, limit: l, offset } = getPaginationParams(page, limit);
    const prisma = (app as any).prisma;

    const where: any = {};
    if (q) where.name = { contains: q, mode: 'insensitive' };
    if (category) where.category = category;

    const [communities, total] = await Promise.all([
      prisma.community.findMany({
        where,
        skip: offset,
        take: l,
        include: {
          owner: { select: { id: true, fullName: true } },
          _count: { select: { memberships: { where: { status: 'APPROVED' } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.community.count({ where }),
    ]);

    return { data: communities, meta: buildPaginationMeta(p, l, total) };
  });

  app.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    const body = createCommunitySchema.parse(request.body);
    const prisma = (app as any).prisma;

    const slug = generateSlug(body.name);
    const existing = await prisma.community.findUnique({ where: { slug } });
    if (existing) {
      throw new AppError(409, 'A community with this name already exists');
    }

    const community = await prisma.community.create({
      data: {
        ...body,
        slug,
        ownerId: request.user!.id,
        memberships: {
          create: {
            userId: request.user!.id,
            role: 'MEMBER',
            status: 'APPROVED',
          },
        },
      },
      include: {
        owner: { select: { id: true, fullName: true } },
        _count: { select: { memberships: { where: { status: 'APPROVED' } } } },
      },
    });

    return reply.status(201).send(community);
  });

  app.get('/:slug', async (request) => {
    const { slug } = request.params as { slug: string };
    const prisma = (app as any).prisma;

    const community = await prisma.community.findUnique({
      where: { slug },
      include: {
        owner: { select: { id: true, fullName: true, profile: { select: { avatarUrl: true } } } },
        memberships: {
          where: { status: 'APPROVED' },
          include: {
            user: {
              select: { id: true, fullName: true, profile: { select: { username: true, avatarUrl: true, profession: true, skills: true } } },
            },
          },
        },
        _count: { select: { memberships: { where: { status: 'APPROVED' } } } },
      },
    });

    if (!community) {
      throw new AppError(404, 'Community not found');
    }

    return community;
  });

  app.put('/:slug', { preHandler: [authenticate] }, async (request) => {
    const { slug } = request.params as { slug: string };
    const body = updateCommunitySchema.parse(request.body);
    const prisma = (app as any).prisma;

    const community = await prisma.community.findUnique({ where: { slug } });
    if (!community) throw new AppError(404, 'Community not found');
    if (community.ownerId !== request.user!.id) throw new AppError(403, 'Only the owner can update this community');

    return prisma.community.update({ where: { slug }, data: body });
  });

  app.delete('/:slug', { preHandler: [authenticate] }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const prisma = (app as any).prisma;

    const community = await prisma.community.findUnique({ where: { slug } });
    if (!community) throw new AppError(404, 'Community not found');
    if (community.ownerId !== request.user!.id) throw new AppError(403, 'Only the owner can delete this community');

    await prisma.community.delete({ where: { slug } });
    return reply.status(204).send();
  });
}
