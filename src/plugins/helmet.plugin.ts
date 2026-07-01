import { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';

export async function helmetPlugin(app: FastifyInstance) {
  await app.register(helmet);
}
