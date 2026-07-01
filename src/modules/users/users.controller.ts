import { FastifyRequest, FastifyReply } from 'fastify';

export async function getMe(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user!;
  const prisma = (request.server as any).prisma;

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { profile: true },
  });

  return reply.send({ user: fullUser });
}
