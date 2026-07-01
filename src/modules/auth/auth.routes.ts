import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';

export async function authRoutes(app: FastifyInstance) {
  app.post('/sync', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user!;
    const prisma = (app as any).prisma;

    const existingUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { profile: true },
    });

    if (existingUser) {
      return reply.send(existingUser);
    }

    const newUser = await prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        profile: {
          create: {
            username: user.email.split('@')[0] + '_' + Date.now(),
            fullName: user.email.split('@')[0],
          },
        },
      },
      include: { profile: true },
    });

    return reply.status(201).send(newUser);
  });
}
