import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
/**
 * Middleware that validates `req.body` against a Zod schema.
 * On failure it returns a 400 response with a normalized error payload.
 */
export const validateBody = (schema: ZodSchema<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message }));
      return res.status(400).json({
        success: false,
        error: { code: 'EVALIDATION', message: 'Invalid request body', details: errors },
      });
    }
    // Replace body with parsed / coerced data
    req.body = result.data;
    next();
  };
};
