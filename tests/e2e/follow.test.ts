import request from 'supertest';
import app from '../../src/app';
import { mockAuthUser } from '../utils/authMock';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Follow/Unfollow E2E API', () => {
  const userAToken = 'user-a-token';
  const userAId = 'user-a-id';
  const userAEmail = 'usera@example.com';

  const userBToken = 'user-b-token';
  const userBId = 'user-b-id';
  const userBEmail = 'userb@example.com';

  beforeEach(async () => {
    mockAuthUser(userAToken, userAId, userAEmail);
    mockAuthUser(userBToken, userBId, userBEmail);

    await prisma.user.create({
      data: {
        id: userAId,
        email: userAEmail,
        profile: { create: { username: 'user_a' } },
      },
    });

    await prisma.user.create({
      data: {
        id: userBId,
        email: userBEmail,
        profile: { create: { username: 'user_b' } },
      },
    });
  });

  // Tier 1 Tests
  test('T1.1: Follows a user successfully (returns 201 with followersCount)', async () => {
    const res = await request(app)
      .post(`/api/v1/users/${userBId}/follow`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('followersCount', 1);

    const dbFollow = await prisma.follower.findUnique({
      where: { followerId_followingId: { followerId: userAId, followingId: userBId } },
    });
    expect(dbFollow).toBeDefined();
  });

  test('T1.2: Unfollows a user successfully (returns 200 with followersCount)', async () => {
    await prisma.follower.create({
      data: { followerId: userAId, followingId: userBId },
    });

    const res = await request(app)
      .delete(`/api/v1/users/${userBId}/follow`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('followersCount', 0);

    const dbFollow = await prisma.follower.findUnique({
      where: { followerId_followingId: { followerId: userAId, followingId: userBId } },
    });
    expect(dbFollow).toBeNull();
  });

  test('T1.3: Checks is-following status (returns boolean)', async () => {
    const resNotFollowing = await request(app)
      .get(`/api/v1/users/${userBId}/is-following`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(resNotFollowing.status).toBe(200);
    expect(resNotFollowing.body).toHaveProperty('isFollowing', false);

    await prisma.follower.create({
      data: { followerId: userAId, followingId: userBId },
    });

    const resFollowing = await request(app)
      .get(`/api/v1/users/${userBId}/is-following`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(resFollowing.status).toBe(200);
    expect(resFollowing.body).toHaveProperty('isFollowing', true);
  });

  test('T1.4: Returns 400 when trying to follow yourself', async () => {
    const res = await request(app)
      .post(`/api/v1/users/${userAId}/follow`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Cannot follow yourself');
  });

  test('T1.5: Returns 404 when following a non-existent user', async () => {
    const res = await request(app)
      .post('/api/v1/users/non-existent-id/follow')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  // Tier 2 Tests
  test('T2.1: Returns 409 when already following', async () => {
    await prisma.follower.create({
      data: { followerId: userAId, followingId: userBId },
    });

    const res = await request(app)
      .post(`/api/v1/users/${userBId}/follow`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error', 'Already following');
  });

  test('T2.2: Unfollow is idempotent (returns 200 even if not following)', async () => {
    const res = await request(app)
      .delete(`/api/v1/users/${userBId}/follow`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('followersCount', 0);
  });

  test('T2.3: Returns 401 when no token provided', async () => {
    const res = await request(app)
      .post(`/api/v1/users/${userBId}/follow`);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'No token provided');
  });

  test('T2.4: Multiple followers count correctly', async () => {
    const userCToken = 'user-c-token';
    const userCId = 'user-c-id';
    const userCEmail = 'userc@example.com';
    mockAuthUser(userCToken, userCId, userCEmail);

    await prisma.user.create({
      data: {
        id: userCId,
        email: userCEmail,
        profile: { create: { username: 'user_c' } },
      },
    });

    await request(app)
      .post(`/api/v1/users/${userBId}/follow`)
      .set('Authorization', `Bearer ${userAToken}`);

    await request(app)
      .post(`/api/v1/users/${userBId}/follow`)
      .set('Authorization', `Bearer ${userCToken}`);

    const res = await request(app)
      .get(`/api/v1/users/${userBId}/is-following`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isFollowing).toBe(true);

    const profileRes = await request(app)
      .get('/api/v1/profiles/user_b');

    expect(profileRes.status).toBe(200);
    expect(profileRes.body.followersCount).toBe(2);
  });

  test('T2.5: Follow/unfollow updates followersCount correctly', async () => {
    const followRes = await request(app)
      .post(`/api/v1/users/${userBId}/follow`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(followRes.body.followersCount).toBe(1);

    const unfollowRes = await request(app)
      .delete(`/api/v1/users/${userBId}/follow`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(unfollowRes.body.followersCount).toBe(0);
  });
});
