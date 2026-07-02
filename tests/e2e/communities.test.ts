import request from 'supertest';
import app from '../../src/app';
import { mockAuthUser } from '../utils/authMock';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Communities CRUD E2E API (POST/GET/PUT/DELETE /api/v1/communities)', () => {
  const ownerToken = 'owner-token';
  const ownerId = 'owner-id';
  const ownerEmail = 'owner@example.com';

  const memberToken = 'member-token';
  const memberId = 'member-id';
  const memberEmail = 'member@example.com';

  beforeEach(async () => {
    mockAuthUser(ownerToken, ownerId, ownerEmail);
    mockAuthUser(memberToken, memberId, memberEmail);

    // Seed owner and member in database
    await prisma.user.create({
      data: {
        id: ownerId,
        email: ownerEmail,
        profile: { create: { username: 'owner_user' } },
      },
    });

    await prisma.user.create({
      data: {
        id: memberId,
        email: memberEmail,
        profile: { create: { username: 'member_user' } },
      },
    });
  });

  // Tier 1 Tests
  test('T1.1: Creates a community successfully and automatically joins owner', async () => {
    const res = await request(app)
      .post('/api/v1/communities')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'NodeJS Mastery',
        description: 'A community for NodeJS developers.',
        category: 'Development',
        tags: ['nodejs', 'javascript'],
        rules: 'Be nice.',
        visibility: 'PUBLIC',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('name', 'NodeJS Mastery');
    expect(res.body).toHaveProperty('slug', 'nodejs-mastery');
    expect(res.body.ownerId).toBe(ownerId);
    expect(res.body._count.memberships).toBe(1);

    // Verify DB membership for owner
    const membership = await prisma.membership.findFirst({
      where: { communityId: res.body.id, userId: ownerId },
    });
    expect(membership).toBeDefined();
    expect(membership?.status).toBe('APPROVED');
  });

  test('T1.2: Lists communities with pagination meta', async () => {
    // Seed a couple of communities
    await prisma.community.create({
      data: { name: 'Comm A', slug: 'comm-a', ownerId },
    });
    await prisma.community.create({
      data: { name: 'Comm B', slug: 'comm-b', ownerId },
    });

    const res = await request(app)
      .get('/api/v1/communities?page=1&limit=2');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 2,
      total: 2,
      totalPages: 1,
    });
  });

  test('T1.3: Fetches community details by slug successfully', async () => {
    await prisma.community.create({
      data: { name: 'Slug Test', slug: 'slug-test', ownerId },
    });

    const res = await request(app)
      .get('/api/v1/communities/slug-test');

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Slug Test');
    expect(res.body.owner.fullName).toBeDefined();
  });

  test('T1.4: Updates community properties when called by the owner', async () => {
    await prisma.community.create({
      data: { name: 'Original Name', slug: 'original-name', ownerId },
    });

    const res = await request(app)
      .put('/api/v1/communities/original-name')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        description: 'New Description Updated',
        rules: 'New Rules',
      });

    expect(res.status).toBe(200);
    expect(res.body.description).toBe('New Description Updated');
    expect(res.body.rules).toBe('New Rules');
  });

  test('T1.5: Deletes community when called by the owner', async () => {
    await prisma.community.create({
      data: { name: 'Delete Me', slug: 'delete-me', ownerId },
    });

    const res = await request(app)
      .delete('/api/v1/communities/delete-me')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(204);

    const dbComm = await prisma.community.findUnique({
      where: { slug: 'delete-me' },
    });
    expect(dbComm).toBeNull();
  });

  // Tier 2 Tests (Boundary & Corner Cases)
  test('T2.1: Returns 409 when creating a community with duplicate slug', async () => {
    await prisma.community.create({
      data: { name: 'Duplicate Slugs', slug: 'duplicate-slugs', ownerId },
    });

    const res = await request(app)
      .post('/api/v1/communities')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Duplicate Slugs',
      });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error', 'Community already exists');
  });

  test('T2.2: Returns 404 when community slug does not exist', async () => {
    const res = await request(app)
      .get('/api/v1/communities/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Community not found');
  });

  test('T2.3: Returns 403 when non-owner attempts to update community', async () => {
    await prisma.community.create({
      data: { name: 'Protected Hub', slug: 'protected-hub', ownerId },
    });

    const res = await request(app)
      .put('/api/v1/communities/protected-hub')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ description: 'Attacking description' });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Forbidden');
  });

  test('T2.4: Returns 403 when non-owner attempts to delete community', async () => {
    await prisma.community.create({
      data: { name: 'Protected Hub', slug: 'protected-hub', ownerId },
    });

    const res = await request(app)
      .delete('/api/v1/communities/protected-hub')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Forbidden');
  });

  test('T2.5: Validates limit and page boundary conditions', async () => {
    // Seed 5 communities
    for (let i = 0; i < 5; i++) {
      await prisma.community.create({
        data: { name: `Comm ${i}`, slug: `comm-${i}`, ownerId },
      });
    }

    // Limit above ceiling (app will restrict to max 100 or default, but let's check parsing works)
    const resHugeLimit = await request(app)
      .get('/api/v1/communities?limit=1000');
    expect(resHugeLimit.status).toBe(200);
    expect(resHugeLimit.body.data).toHaveLength(5);
    expect(resHugeLimit.body.meta.limit).toBe(100); // capped at 100

    // Negative page and limit should fall back to defaults
    const resNegative = await request(app)
      .get('/api/v1/communities?page=-5&limit=-10');
    expect(resNegative.status).toBe(200);
    expect(resNegative.body.meta.page).toBe(1);
    expect(resNegative.body.meta.limit).toBe(1); // Math.max(1, parseInt(limit)) => Math.max(1, -10) => 1
  });
});
