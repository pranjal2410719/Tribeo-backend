import { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../../shared/errors/app-error';

export async function getPublicProfile(request: FastifyRequest, reply: FastifyReply) {
  const { username } = request.params as { username: string };
  const prisma = (request.server as any).prisma;

  const profile = await prisma.profile.findUnique({
    where: { username },
    include: { user: { select: { id: true, email: true } } },
  });

  if (!profile) {
    throw new AppError(404, 'Profile not found');
  }

  return reply.send({ profile });
}

export async function getMyProfile(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user!;
  const prisma = (request.server as any).prisma;

  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
    include: { user: { select: { id: true, email: true } } },
  });

  if (!profile) {
    return reply.send({ profile: null });
  }

  return reply.send({ profile });
}

export async function updateMyProfile(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user!;
  const prisma = (request.server as any).prisma;
  const body = request.body as any;

  const existingProfile = await prisma.profile.findUnique({
    where: { userId: user.id },
  });

  if (!existingProfile) {
    if (!body.username) {
      throw new AppError(400, 'Username is required for new profiles');
    }

    const profile = await prisma.profile.create({
      data: {
        userId: user.id,
        username: body.username,
        bio: body.bio,
        profession: body.profession,
        location: body.location,
        skills: body.skills || [],
        interests: body.interests || [],
      },
    });

    return reply.status(201).send({ profile });
  }

  const profile = await prisma.profile.update({
    where: { userId: user.id },
    data: {
      bio: body.bio,
      profession: body.profession,
      location: body.location,
      avatarUrl: body.avatarUrl,
      coverUrl: body.coverUrl,
      githubUrl: body.githubUrl,
      linkedinUrl: body.linkedinUrl,
      websiteUrl: body.websiteUrl,
      portfolioUrl: body.portfolioUrl,
      skills: body.skills,
      interests: body.interests,
    },
  });

  return reply.send({ profile });
}
