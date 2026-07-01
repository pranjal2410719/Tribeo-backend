import { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../shared/errors/app-error';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'Missing or invalid authorization header');
  }

  const token = authHeader.split(' ')[1];

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    throw new AppError(401, 'Invalid or expired token');
  }

  request.user = {
    id: data.user.id,
    email: data.user.email ?? '',
  };
}
