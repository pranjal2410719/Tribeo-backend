import request from 'supertest';
import app from '../../src/app';
import { mockAuthUser } from '../utils/authMock';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Memberships E2E API (POST/DELETE join/leave, GET members)', () => {
  const ownerToken = 'owner-token-member';
  const ownerId = 'owner-id-member';
  const ownerEmail = 'ownermember@example.com';

  const userToken = 'user-token-member';
  const userId = 'user-id-member';
  const userEmail = 'usermember@example.com';

  beforeEach(async () => {
    mockAuthUser(ownerToken, ownerId, ownerEmail);
    mockAuthUser(userToken, userId, userEmail);

    // Seed database
    await prisma.user.create({
      data: {
        id: ownerId,
        email: ownerEmail,
        profile: { create: { username: 'owner_member' } },
      },
    });

    await prisma.user.create({
      data: {
        id: userId,
        email: userEmail,
        profile: { create: { username: 'user_member' } },
      },
    });

    // Public community
    const pubComm = await prisma.community.create({
      data: { name: 'Public Comm', slug: 'public-comm', ownerId: ownerId, visibility: 'PUBLIC' },
    });
    await prisma.membership.create({
      data: { communityId: pubComm.id, userId: ownerId, status: 'APPROVED', role: 'MEMBER' },
    });

    // Private community
    const privComm = await prisma.community.create({
      data: { name: 'Private Comm', slug: 'private-comm', ownerId: ownerId, visibility: 'PRIVATE' },
    });
    await prisma.membership.create({
      data: { communityId: privComm.id, userId: ownerId, status: 'APPROVED', role: 'MEMBER' },
    });
  });

  // Tier 1 Tests
  test('T1.1: Joins a public community successfully (returns 201 with status=APPROVED)', async () => {
    const res = await request(app)
      .post('/api/v1/communities/public-comm/join')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('APPROVED');
    expect(res.body.role).toBe('MEMBER');
  });

  test('T1.2: Joins a private community successfully (returns 201 with status=PENDING)', async () => {
    const res = await request(app)
      .post('/api/v1/communities/private-comm/join')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
  });

  test('T1.3: Leaves a community successfully (returns 204)', async () => {
    // Seed approved membership first
    const comm = await prisma.community.findUnique({ where: { slug: 'public-comm' } });
    await prisma.membership.create({
      data: { communityId: comm!.id, userId: userId, status: 'APPROVED', role: 'MEMBER' },
    });

    const res = await request(app)
      .delete('/api/v1/communities/public-comm/leave')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(204);

    const membership = await prisma.membership.findFirst({
      where: { communityId: comm!.id, userId: userId },
    });
    expect(membership).toBeNull();
  });

  test('T1.4: Returns members of a community successfully (200)', async () => {
    const res = await request(app)
      .get('/api/v1/communities/public-comm/members');

    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
  });

  test('T1.5: Returns 404 for join when community slug is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/communities/invalid-slug-xyz/join')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Not found');
  });

  // Tier 2 Tests (Boundary & Corner Cases)
  test('T2.1: Returns 409 when user is already an approved member', async () => {
    const comm = await prisma.community.findUnique({ where: { slug: 'public-comm' } });
    await prisma.membership.create({
      data: { communityId: comm!.id, userId: userId, status: 'APPROVED', role: 'MEMBER' },
    });

    const res = await request(app)
      .post('/api/v1/communities/public-comm/join')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error', 'Already a member');
  });

  test('T2.2: Re-joining a community with pending status keeps status pending', async () => {
    const comm = await prisma.community.findUnique({ where: { slug: 'private-comm' } });
    await prisma.membership.create({
      data: { communityId: comm!.id, userId: userId, status: 'PENDING', role: 'MEMBER' },
    });

    const res = await request(app)
      .post('/api/v1/communities/private-comm/join')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
  });

  test('T2.3: Returns 204 for leave even if user was never a member (idempotence)', async () => {
    const res = await request(app)
      .delete('/api/v1/communities/public-comm/leave')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(204);
  });

  test('T2.4: Returns 404 for member list if community slug does not exist', async () => {
    const res = await request(app)
      .get('/api/v1/communities/does-not-exist/members');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Not found');
  });

  test('T2.5: Only returns approved members in the members list', async () => {
    const comm = await prisma.community.findUnique({ where: { slug: 'private-comm' } });

    // Seed approved member
    await prisma.membership.create({
      data: { communityId: comm!.id, userId: userId, status: 'APPROVED', role: 'MEMBER' },
    });

    // Seed pending member
    await prisma.user.create({
      data: {
        id: 'pending-user-id',
        email: 'pending_user@example.com',
        profile: { create: { username: 'pending_user' } },
      },
    });
    await prisma.membership.create({
      data: { communityId: comm!.id, userId: 'pending-user-id', status: 'PENDING', role: 'MEMBER' },
    });

    const res = await request(app)
      .get('/api/v1/communities/private-comm/members');

    expect(res.status).toBe(200);
    // Should return only approved members (owner is also approved automatically during community creation!)
    // So owner + user-id-member = 2 members.
    expect(res.body).toHaveLength(2);
    const usernames = res.body.map((m: any) => m.user.profile.username);
    expect(usernames).toContain('owner_member');
    expect(usernames).toContain('user_member');
    expect(usernames).not.toContain('pending_user');
  });
});
