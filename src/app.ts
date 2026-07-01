// @ts-nocheck
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const app = express();
app.use(cors());
app.use(express.json());

// Auth middleware
async function authenticate(req: any, res: any, next: any) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Invalid token' });

  req.user = { id: data.user.id, email: data.user.email };
  next();
}

// Health
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth sync
app.post('/api/v1/auth/sync', authenticate, async (req: any, res) => {
  try {
    const existing = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { profile: true },
    });
    if (existing) return res.json(existing);

    const user = await prisma.user.create({
      data: {
        id: req.user.id,
        email: req.user.email,
        profile: {
          create: {
            username: req.user.email.split('@')[0] + '_' + Date.now(),
            fullName: req.user.email.split('@')[0],
          },
        },
      },
      include: { profile: true },
    });
    res.status(201).json(user);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Profiles
app.get('/api/v1/profiles/me', authenticate, async (req: any, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { id: true, email: true } } },
    });
    res.json(profile);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/profiles/:username', async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { username: req.params.username },
      include: {
        user: { select: { id: true, email: true } },
        memberships: {
          where: { status: 'APPROVED' },
          include: { community: { select: { id: true, name: true, slug: true } } },
        },
      },
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json(profile);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/v1/profiles/me', authenticate, async (req: any, res) => {
  try {
    const profile = await prisma.profile.update({
      where: { userId: req.user.id },
      data: req.body,
    });
    res.json(profile);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Communities
app.get('/api/v1/communities', async (req, res) => {
  try {
    const { q, category, page = '1', limit = '20' } = req.query as any;
    const p = Math.max(1, parseInt(page));
    const l = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (p - 1) * l;

    const where: any = {};
    if (q) where.name = { contains: q, mode: 'insensitive' };
    if (category) where.category = category;

    const [communities, total] = await Promise.all([
      prisma.community.findMany({
        where, skip: offset, take: l,
        include: { _count: { select: { memberships: { where: { status: 'APPROVED' } } } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.community.count({ where }),
    ]);

    res.json({ data: communities, meta: { page: p, limit: l, total, totalPages: Math.ceil(total / l) } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/communities', authenticate, async (req: any, res) => {
  try {
    const { name, description, category, tags, rules, visibility } = req.body;
    const slug = name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

    const existing = await prisma.community.findUnique({ where: { slug } });
    if (existing) return res.status(409).json({ error: 'Community already exists' });

    const community = await prisma.community.create({
      data: { name, slug, description, category, tags, rules, visibility: visibility || 'PUBLIC', ownerId: req.user.id,
        memberships: { create: { userId: req.user.id, role: 'MEMBER', status: 'APPROVED' } },
      },
      include: { _count: { select: { memberships: { where: { status: 'APPROVED' } } } } },
    });
    res.status(201).json(community);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/communities/:slug', async (req, res) => {
  try {
    const community = await prisma.community.findUnique({
      where: { slug: req.params.slug },
      include: {
        owner: { select: { id: true, fullName: true } },
        memberships: {
          where: { status: 'APPROVED' },
          include: { user: { select: { id: true, profile: { select: { username: true, avatarUrl: true, profession: true, skills: true } } } } },
        },
        _count: { select: { memberships: { where: { status: 'APPROVED' } } } },
      },
    });
    if (!community) return res.status(404).json({ error: 'Community not found' });
    res.json(community);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/v1/communities/:slug', authenticate, async (req: any, res) => {
  try {
    const community = await prisma.community.findUnique({ where: { slug: req.params.slug } });
    if (!community) return res.status(404).json({ error: 'Not found' });
    if (community.ownerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const updated = await prisma.community.update({ where: { slug: req.params.slug }, data: req.body });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/v1/communities/:slug', authenticate, async (req: any, res) => {
  try {
    const community = await prisma.community.findUnique({ where: { slug: req.params.slug } });
    if (!community) return res.status(404).json({ error: 'Not found' });
    if (community.ownerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    await prisma.community.delete({ where: { slug: req.params.slug } });
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Memberships
app.post('/api/v1/communities/:slug/join', authenticate, async (req: any, res) => {
  try {
    const community = await prisma.community.findUnique({ where: { slug: req.params.slug } });
    if (!community) return res.status(404).json({ error: 'Not found' });

    const existing = await prisma.membership.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
    });
    if (existing?.status === 'APPROVED') return res.status(409).json({ error: 'Already a member' });

    const membership = await prisma.membership.upsert({
      where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
      create: { communityId: community.id, userId: req.user.id, status: community.visibility === 'PUBLIC' ? 'APPROVED' : 'PENDING', role: 'MEMBER' },
      update: { status: community.visibility === 'PUBLIC' ? 'APPROVED' : 'PENDING' },
    });
    res.status(201).json(membership);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/v1/communities/:slug/leave', authenticate, async (req: any, res) => {
  try {
    const community = await prisma.community.findUnique({ where: { slug: req.params.slug } });
    if (!community) return res.status(404).json({ error: 'Not found' });

    await prisma.membership.deleteMany({ where: { communityId: community.id, userId: req.user.id } });
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/communities/:slug/members', async (req, res) => {
  try {
    const community = await prisma.community.findUnique({ where: { slug: req.params.slug } });
    if (!community) return res.status(404).json({ error: 'Not found' });

    const members = await prisma.membership.findMany({
      where: { communityId: community.id, status: 'APPROVED' },
      include: { user: { select: { id: true, profile: { select: { username: true, fullName: true, avatarUrl: true, profession: true, skills: true } } } } },
    });
    res.json(members);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Search
app.get('/api/v1/search/communities', async (req, res) => {
  try {
    const { q, category } = req.query as any;
    const where: any = {};
    if (q) where.name = { contains: q, mode: 'insensitive' };
    if (category) where.category = category;

    const communities = await prisma.community.findMany({
      where, take: 50, orderBy: { createdAt: 'desc' },
      include: { _count: { select: { memberships: { where: { status: 'APPROVED' } } } } },
    });
    res.json(communities);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/search/people', async (req, res) => {
  try {
    const { q, skills } = req.query as any;
    const where: any = { isActive: true };
    if (q) where.OR = [{ username: { contains: q, mode: 'insensitive' } }, { profession: { contains: q, mode: 'insensitive' } }];
    if (skills) where.skills = { hasSome: Array.isArray(skills) ? skills : [skills] };

    const profiles = await prisma.profile.findMany({ where, take: 50 });
    res.json(profiles);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Users
app.get('/api/v1/users/me', authenticate, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { profile: true, _count: { select: { memberships: true, ownedCommunities: true } } },
    });
    res.json(user);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Admin
app.get('/api/v1/admin/stats', async (_req, res) => {
  try {
    const [users, communities, memberships] = await Promise.all([
      prisma.user.count(), prisma.community.count(),
      prisma.membership.count({ where: { status: 'APPROVED' } }),
    ]);
    res.json({ users, communities, memberships });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 404
app.use((_req, res) => {
  res.status(404).json({ statusCode: 404, error: 'Not Found', message: 'Route not found' });
});

export default app;
