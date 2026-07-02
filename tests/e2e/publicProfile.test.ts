import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const mockProfileFindUnique = jest.fn();
jest.mock('@prisma/client', () => {
  const actual = jest.requireActual('@prisma/client');
  return {
    ...actual,
    PrismaClient: class extends actual.PrismaClient {
      constructor(options: any) {
        super(options);
        const orig = this.profile.findUnique.bind(this.profile);
        this.profile.findUnique = (args: any) => {
          return mockProfileFindUnique(args, orig);
        };
      }
    }
  };
});

import app from '../../src/app';
const prisma = new PrismaClient();

describe('Public Profile E2E API (GET /api/v1/profiles/:username)', () => {
  const userId = 'user-public-profile-id';
  const email = 'publicprofile@example.com';
  const username = 'public_user_1';

  beforeEach(async () => {
    mockProfileFindUnique.mockImplementation((args: any, orig: any) => orig(args));
    // Seed user
    const user = await prisma.user.create({
      data: {
        id: userId,
        email: email,
        fullName: 'Public User One',
        profile: {
          create: {
            username: username,
            bio: 'Public bio details.',
          },
        },
      },
    });

    // Create a community
    const community = await prisma.community.create({
      data: {
        name: 'Open Community',
        slug: 'open-community',
        ownerId: userId,
      },
    });

    // Create an approved membership
    await prisma.membership.create({
      data: {
        communityId: community.id,
        userId: userId,
        status: 'APPROVED',
        role: 'MEMBER',
      },
    });
  });

  // Tier 1 Tests
  test('T1.1: Returns public profile successfully (200) with user and memberships', async () => {
    const res = await request(app)
      .get(`/api/v1/profiles/${username}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('username', username);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('email', email);
    expect(res.body.memberships).toHaveLength(1);
    expect(res.body.memberships[0].community.slug).toBe('open-community');
  });

  test('T1.2: Returns 404 when username does not exist', async () => {
    const res = await request(app)
      .get('/api/v1/profiles/nonexistent_user');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Profile not found');
  });

  test('T1.3: Returns profile with empty memberships if none are approved', async () => {
    // Seed user with no membership
    await prisma.user.create({
      data: {
        id: 'no-member-id',
        email: 'nomember@example.com',
        profile: {
          create: {
            username: 'no_member_user',
          },
        },
      },
    });

    const res = await request(app)
      .get('/api/v1/profiles/no_member_user');

    expect(res.status).toBe(200);
    expect(res.body.memberships).toHaveLength(0);
  });

  test('T1.4: Verifies the structural properties returned by the endpoint', async () => {
    const res = await request(app)
      .get(`/api/v1/profiles/${username}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('userId');
    expect(res.body).toHaveProperty('username');
    expect(res.body).toHaveProperty('bio');
    expect(res.body).toHaveProperty('skills');
    expect(res.body).toHaveProperty('interests');
  });

  test('T1.5: Handles internal server error when fetching public profile fails', async () => {
    mockProfileFindUnique.mockRejectedValueOnce(new Error('Query Error') as never);

    const res = await request(app)
      .get(`/api/v1/profiles/${username}`);

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error', 'Query Error');
  });

  // Tier 2 Tests (Boundary & Corner Cases)
  test('T2.1: Handles username containing dots, dashes, and underscores', async () => {
    const specialUsername = 'john.doe-test_name';
    await prisma.user.create({
      data: {
        id: 'user-special-id',
        email: 'special@example.com',
        profile: {
          create: {
            username: specialUsername,
          },
        },
      },
    });

    const res = await request(app)
      .get(`/api/v1/profiles/${specialUsername}`);

    expect(res.status).toBe(200);
    expect(res.body.username).toBe(specialUsername);
  });

  test('T2.2: Returns 404 for wrong case due to exact match unique constraint', async () => {
    const upperUsername = username.toUpperCase();
    const res = await request(app)
      .get(`/api/v1/profiles/${upperUsername}`);

    expect(res.status).toBe(404);
  });

  test('T2.3: Does not return memberships that are pending approval', async () => {
    // Create community
    const privateComm = await prisma.community.create({
      data: {
        name: 'Private Hub',
        slug: 'private-hub',
        ownerId: userId,
        visibility: 'PRIVATE',
      },
    });

    // Create pending membership
    await prisma.membership.create({
      data: {
        communityId: privateComm.id,
        userId: userId,
        status: 'PENDING',
        role: 'MEMBER',
      },
    });

    const res = await request(app)
      .get(`/api/v1/profiles/${username}`);

    expect(res.status).toBe(200);
    // Should still only have the approved one from beforeEach
    expect(res.body.memberships).toHaveLength(1);
    expect(res.body.memberships[0].community.slug).not.toBe('private-hub');
  });

  test('T2.4: Does not return memberships that are banned', async () => {
    // Create community
    const testComm = await prisma.community.create({
      data: {
        name: 'Banned Test Hub',
        slug: 'banned-test-hub',
        ownerId: userId,
      },
    });

    // Create banned membership
    await prisma.membership.create({
      data: {
        communityId: testComm.id,
        userId: userId,
        status: 'BANNED',
        role: 'MEMBER',
      },
    });

    const res = await request(app)
      .get(`/api/v1/profiles/${username}`);

    expect(res.status).toBe(200);
    expect(res.body.memberships).toHaveLength(1);
    expect(res.body.memberships[0].community.slug).not.toBe('banned-test-hub');
  });

  test('T2.5: Returns multiple approved memberships correctly in the public profile', async () => {
    // Create second community and membership
    const comm2 = await prisma.community.create({
      data: {
        name: 'Community Two',
        slug: 'community-two',
        ownerId: userId,
      },
    });
    await prisma.membership.create({
      data: {
        communityId: comm2.id,
        userId: userId,
        status: 'APPROVED',
        role: 'MEMBER',
      },
    });

    const res = await request(app)
      .get(`/api/v1/profiles/${username}`);

    expect(res.status).toBe(200);
    expect(res.body.memberships).toHaveLength(2);
  });
});
