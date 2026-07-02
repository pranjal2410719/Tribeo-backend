import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * Middleware to verify Supabase JWT and attach user info to req.user
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Attach minimal user info to request
  (req as any).user = {
    id: data.user.id,
    email: data.user.email,
    // role could be part of custom claims; default to 'member'
    role: (data.user as any).role ?? 'member',
  };
  next();
}
