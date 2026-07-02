import { Request, Response, NextFunction } from 'express';

/**
 * Global error handling middleware. It expects errors to be thrown or passed
 * to `next(err)`. It normalizes the response shape so the frontend can rely on
 * a consistent envelope.
 */
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error('Unhandled error:', err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'EUNKNOWN';
  res.status(status).json({ success: false, error: { code, message } });
}
