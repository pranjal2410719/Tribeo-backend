import { FastifyInstance } from 'fastify';
import { AppError } from '../../shared/errors/app-error';

export async function searchRoutes(app: FastifyInstance) {
  app.get('/communities', async (request) => {
    const { q, category, tags } = request.query as any;
    const prisma = (app as any).prisma;

    const where: any = {};
    if (q) where.name = { contains: q, mode: 'insensitive' };
    if (category) where.category = category;
    if (tags) where.tags = { hasSome: Array.isArray(tags) ? tags : [tags] };

    const communities = await prisma.community.findMany({
      where,
      include: {
        owner: { select: { id: true, fullName: true } },
        _count: { select: { memberships: { where: { status: 'APPROVED' } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return communities;
  });

  app.get('/people', async (request) => {
    const { q, skills } = request.query as any;
    const prisma = (app as any).prisma;

    const where: any = { isActive: true };
    if (q) {
      where.OR = [
        { username: { contains: q, mode: 'insensitive' } },
        { profession: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (skills) {
      const skillArray = Array.isArray(skills) ? skills : [skills];
      where.skills = { hasSome: skillArray };
    }

    const profiles = await prisma.profile.findMany({
      where,
      include: { user: { select: { id: true } } },
      take: 50,
    });

    return profiles;
  });
}
