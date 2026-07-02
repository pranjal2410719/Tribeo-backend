import pino from 'pino';
import { Request, Response, NextFunction } from 'express';

// Create a pino logger instance
const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
});

// Express middleware to log each request
export const requestLogger = (req: Request, _res: Response, next: NextFunction) => {
  const start = Date.now();
  logger.info({ method: req.method, url: req.originalUrl, ip: req.ip }, 'Incoming request');
  _res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({ status: _res.statusCode, duration }, 'Request completed');
  });
  next();
};

export default logger;
