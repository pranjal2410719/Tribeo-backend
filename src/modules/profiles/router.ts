import { Router, Request, Response } from 'express';

const router = Router();

// GET /api/v1/profiles/me (already covered by auth middleware) – placeholder
router.get('/me', (req: Request, res: Response) => {
  res.json({ success: true, data: null, message: 'Profile endpoint placeholder' });
});

export default router;
