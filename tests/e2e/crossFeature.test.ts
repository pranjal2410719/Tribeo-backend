import request from 'supertest';
import app from '../../src/app';
import { mockAuthUser } from '../utils/authMock';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Tier 3: Cross-Feature Pairwise Combination Tests', () => {
  const token = 'cross-token';
  const userId = 'cross-user-id';
  const email = 'crossuser@example.com';

  beforeEach(async () => {
    mockAuthUser(token, userId, email);
  });

  test('T3.1: Pairwise - Auth Sync (POST) + Profile Update (PUT)', async () => {
    // 1. Sync auth
    const syncRes = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${token}`);
    expect(syncRes.status).toBe(201);
    const username = syncRes.body.profile.username;

    // 2. Update profile
    const updateRes = await request(app)
      .put('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ profession: 'DevOps Architect', location: 'Austin, TX' });
    expect(updateRes.status).toBe(200);

    // 3. Verify public profile reflects the update
    const publicRes = await request(app)
      .get(`/api/v1/profiles/${username}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.profession).toBe('DevOps Architect');
    expect(publicRes.body.location).toBe('Austin, TX');
  });

  test('T3.2: Pairwise - Community Creation (POST) + Public Profile Memberships (GET)', async () => {
    // Sync user
    const syncRes = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${token}`);
    const username = syncRes.body.profile.username;

    // Create community
    const commRes = await request(app)
      .post('/api/v1/communities')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cross Community', description: 'Testing cross relations' });
    expect(commRes.status).toBe(201);

    // Get public profile and verify community is in the memberships
    const profileRes = await request(app)
      .get(`/api/v1/profiles/${username}`);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.memberships).toHaveLength(1);
    expect(profileRes.body.memberships[0].community.slug).toBe('cross-community');
  });

  test('T3.3: Pairwise - Join Community (POST) + Community Members list (GET)', async () => {
    // Seed community owner and community
    await prisma.user.create({
      data: {
        id: 'owner-xyz',
        email: 'ownerxyz@example.com',
        profile: { create: { username: 'owner_xyz' } },
        ownedCommunities: {
          create: {
            name: 'Shared Space',
            slug: 'shared-space',
          },
        },
      },
    });

    // Sync member
    await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${token}`);

    // Join community
    const joinRes = await request(app)
      .post('/api/v1/communities/shared-space/join')
      .set('Authorization', `Bearer ${token}`);
    expect(joinRes.status).toBe(201);

    // Get members list
    const membersRes = await request(app)
      .get('/api/v1/communities/shared-space/members');
    expect(membersRes.status).toBe(200);

    const memberIds = membersRes.body.map((m: any) => m.userId);
    expect(memberIds).toContain(userId);
  });

  test('T3.4: Pairwise - Join Community (POST) + Public Profile Memberships (GET)', async () => {
    // Seed community
    await prisma.user.create({
      data: {
        id: 'owner-abc',
        email: 'ownerabc@example.com',
        profile: { create: { username: 'owner_abc' } },
        ownedCommunities: {
          create: {
            name: 'Awesome Hub',
            slug: 'awesome-hub',
          },
        },
      },
    });

    // Sync member
    const syncRes = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${token}`);
    const username = syncRes.body.profile.username;

    // Join community
    await request(app)
      .post('/api/v1/communities/awesome-hub/join')
      .set('Authorization', `Bearer ${token}`);

    // Verify public profile lists it
    const profileRes = await request(app)
      .get(`/api/v1/profiles/${username}`);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.memberships).toHaveLength(1);
    expect(profileRes.body.memberships[0].community.slug).toBe('awesome-hub');
  });

  test('T3.5: Pairwise - Leave Community (DELETE) + Public Profile Memberships (GET)', async () => {
    // Seed community and user membership
    const owner = await prisma.user.create({
      data: {
        id: 'owner-def',
        email: 'ownerdef@example.com',
        profile: { create: { username: 'owner_def' } },
      },
    });
    const comm = await prisma.community.create({
      data: { name: 'Leave Hub', slug: 'leave-hub', ownerId: owner.id },
    });

    // Sync member
    const syncRes = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${token}`);
    const username = syncRes.body.profile.username;

    // Create membership directly
    await prisma.membership.create({
      data: { communityId: comm.id, userId: userId, status: 'APPROVED' },
    });

    // Leave community
    const leaveRes = await request(app)
      .delete('/api/v1/communities/leave-hub/leave')
      .set('Authorization', `Bearer ${token}`);
    expect(leaveRes.status).toBe(204);

    // Verify public profile is empty
    const profileRes = await request(app)
      .get(`/api/v1/profiles/${username}`);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.memberships).toHaveLength(0);
  });

  test('T3.6: Pairwise - Leave Community (DELETE) + Community Members list (GET)', async () => {
    const owner = await prisma.user.create({
      data: {
        id: 'owner-ghi',
        email: 'ownerghi@example.com',
        profile: { create: { username: 'owner_ghi' } },
      },
    });
    const comm = await prisma.community.create({
      data: { name: 'Leave Members Hub', slug: 'leave-members-hub', ownerId: owner.id },
    });

    // Sync member
    await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${token}`);

    // Create membership directly
    await prisma.membership.create({
      data: { communityId: comm.id, userId: userId, status: 'APPROVED' },
    });

    // Leave
    await request(app)
      .delete('/api/v1/communities/leave-members-hub/leave')
      .set('Authorization', `Bearer ${token}`);

    // Verify member list doesn't contain user
    const membersRes = await request(app)
      .get('/api/v1/communities/leave-members-hub/members');
    expect(membersRes.status).toBe(200);
    const memberIds = membersRes.body.map((m: any) => m.userId);
    expect(memberIds).not.toContain(userId);
  });
});
