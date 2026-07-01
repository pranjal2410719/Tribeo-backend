import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { corsPlugin } from './plugins/cors.plugin';
import { helmetPlugin } from './plugins/helmet.plugin';
import { rateLimitPlugin } from './plugins/rate-limit.plugin';
import { prismaPlugin } from './plugins/prisma.plugin';
import { swaggerPlugin } from './plugins/swagger.plugin';
import { errorHandler } from './shared/errors/error-handler';
import { healthRoutes } from './modules/health';
import { authRoutes } from './modules/auth';
import { profilesRoutes } from './modules/profiles';
import { communitiesRoutes } from './modules/communities';
import { membershipsRoutes } from './modules/memberships';
import { moderationRoutes } from './modules/moderation';
import { searchRoutes } from './modules/search';
import { usersRoutes } from './modules/users';
import { mediaRoutes } from './modules/media';
import { adminRoutes } from './modules/admin';
import { env } from './config/env';

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  await app.register(multipart);
  await app.register(corsPlugin);
  await app.register(helmetPlugin);
  await app.register(rateLimitPlugin);
  await app.register(prismaPlugin);
  await app.register(swaggerPlugin);

  app.setErrorHandler(errorHandler);

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Route not found' });
  });

  await app.register(healthRoutes, { prefix: '/api/v1/health' });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(profilesRoutes, { prefix: '/api/v1/profiles' });
  await app.register(communitiesRoutes, { prefix: '/api/v1/communities' });
  await app.register(membershipsRoutes, { prefix: '/api/v1/communities' });
  await app.register(moderationRoutes, { prefix: '/api/v1/communities' });
  await app.register(searchRoutes, { prefix: '/api/v1/search' });
  await app.register(usersRoutes, { prefix: '/api/v1/users' });
  await app.register(mediaRoutes, { prefix: '/api/v1/media' });
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });

  return app;
}
