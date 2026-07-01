import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { AppError } from '../../shared/errors/app-error';
import { getPaginationParams, buildPaginationMeta } from '../../shared/utils/pagination';

const updateProfileSchema = z.object({
  fullName: z.string().optional(),
  username: z.string().min(3).max(30).optional(),
  bio: z.string().max(500).optional(),
  profession: z.string().optional(),
  location: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  coverUrl: z.string().url().optional(),
  githubUrl: z.string().url().optional(),
  linkedinUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
  portfolioUrl: z.string().url().optional(),
  skills: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
});

export async function profilesRoutes(app: FastifyInstance) {
  app.get('/:username', async (request, reply) => {
    const { username } = request.params as { username: string };
    const prisma = (app as any).prisma;

    const profile = await prisma.profile.findUnique({
      where: { username },
      include: {
        user: { select: { id: true, email: true } },
        memberships: {
          where: { status: 'APPROVED' },
          include: { community: { select: { id: true, name: true, slug: true, logo: true } } },
        },
      },
    });

    if (!profile) {
      throw new AppError(404, 'Profile not found');
    }

    return profile;
  });

  app.get('/me', { preHandler: [authenticate] }, async (request) => {
    const prisma = (app as any).prisma;

    const profile = await prisma.profile.findUnique({
      where: { userId: request.user!.id },
      include: {
        user: { select: { id: true, email: true } },
        memberships: {
          include: { community: { select: { id: true, name: true, slug: true, logo: true } } },
        },
      },
    });

    return profile;
  });

  app.put('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const body = updateProfileSchema.parse(request.body);
    const prisma = (app as any).prisma;

    const profile = await prisma.profile.update({
      where: { userId: request.user!.id },
      data: body,
      include: { user: { select: { id: true, email: true } } },
    });

    return profile;
  });
}
