import { FastifyRequest, FastifyReply } from 'fastify';

export async function syncUser(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user!;
  const prisma = (request.server as any).prisma;

  const existingUser = await prisma.user.findUnique({ where: { id: user.id } });

  if (existingUser) {
    return reply.send({ user: existingUser, isNew: false });
  }

  const newUser = await prisma.user.create({
    data: {
      id: user.id,
      email: user.email,
    },
  });

  return reply.status(201).send({ user: newUser, isNew: true });
}
