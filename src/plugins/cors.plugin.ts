import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { env } from '../config/env';

export async function corsPlugin(app: FastifyInstance) {
  await app.register(cors, {
    origin: env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
}
