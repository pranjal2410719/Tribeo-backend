import request from 'supertest';
import { mockAuthUser, mockAuthFailure } from '../utils/authMock';
import { PrismaClient } from '@prisma/client';

const mockUserFindUnique = jest.fn();
jest.mock('@prisma/client', () => {
  const actual = jest.requireActual('@prisma/client');
  return {
    ...actual,
    PrismaClient: class extends actual.PrismaClient {
      constructor(options: any) {
        super(options);
        const orig = this.user.findUnique.bind(this.user);
        this.user.findUnique = (args: any) => {
          return mockUserFindUnique(args, orig);
        };
      }
    }
  };
});

import app from '../../src/app';
const prisma = new PrismaClient();

describe('Auth Sync E2E API (POST /api/v1/auth/sync)', () => {
  beforeEach(() => {
    mockUserFindUnique.mockImplementation((args: any, orig: any) => orig(args));
  });

  test('T1.1: Synchronizes a new user successfully and returns 201', async () => {
    const token = 'valid-token-new';
    const userId = 'user-uuid-1';
    const email = 'newuser@example.com';
    mockAuthUser(token, userId, email);

    const res = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', userId);
    expect(res.body).toHaveProperty('email', email);
    expect(res.body.profile).toBeDefined();

    // Verify DB
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    expect(dbUser).toBeDefined();
    expect(dbUser?.email).toBe(email);
  });

  test('T1.2: Synchronizes an existing user and returns 200', async () => {
    const token = 'valid-token-existing';
    const userId = 'user-uuid-2';
    const email = 'existinguser@example.com';
    mockAuthUser(token, userId, email);

    // Seed user
    await prisma.user.create({
      data: {
        id: userId,
        email: email,
        profile: {
          create: {
            username: 'existing_user_name',
          },
        },
      },
    });

    const res = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', userId);
    expect(res.body.profile.username).toBe('existing_user_name');
  });

  test('T1.3: Fails when no authorization token is provided', async () => {
    const res = await request(app)
      .post('/api/v1/auth/sync');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'No token provided');
  });

  test('T1.4: Fails when an invalid authorization token is provided', async () => {
    const token = 'invalid-token-xyz';
    mockAuthFailure(token);

    const res = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });

  test('T1.5: Handles internal server error when sync process throws', async () => {
    mockUserFindUnique.mockRejectedValueOnce(new Error('DB Failure') as never);

    const token = 'valid-token-error';
    const userId = 'user-uuid-error';
    const email = 'erroruser@example.com';
    mockAuthUser(token, userId, email);

    const res = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error', 'DB Failure');
  });

  test('T2.1: Handles email with special characters and generates profile successfully', async () => {
    const token = 'valid-token-spec';
    const userId = 'user-uuid-spec';
    const email = 'user+test.me@example.com';
    mockAuthUser(token, userId, email);

    const res = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.profile.username).toBeDefined();
  });

  test('T2.2: Handles email with uppercase characters', async () => {
    const token = 'valid-token-upper';
    const userId = 'user-uuid-upper';
    const email = 'USER_UPPER@EXAMPLE.COM';
    mockAuthUser(token, userId, email);

    const res = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(email);
  });

  test('T2.3: Handles exceptionally long email addresses', async () => {
    const token = 'valid-token-long';
    const userId = 'user-uuid-long';
    const email = 'a'.repeat(80) + '@example.com';
    mockAuthUser(token, userId, email);

    const res = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(email);
  });

  test('T2.4: Multiple concurrent sync requests for the same user are handled', async () => {
    const token = 'valid-token-concurrent';
    const userId = 'user-uuid-concurrent';
    const email = 'concurrent@example.com';
    mockAuthUser(token, userId, email);

    const reqs = [
      request(app).post('/api/v1/auth/sync').set('Authorization', `Bearer ${token}`),
      request(app).post('/api/v1/auth/sync').set('Authorization', `Bearer ${token}`),
    ];

    const results = await Promise.all(reqs);
    const statuses = results.map(r => r.status);
    expect(statuses).toContain(201);
    expect(statuses).toContain(200); // One is created, the other is matched
  });

  test('T2.5: Re-syncing does not overwrite an already customized username', async () => {
    const token = 'valid-token-custom';
    const userId = 'user-uuid-custom';
    const email = 'custom@example.com';
    mockAuthUser(token, userId, email);

    // Initial sync
    await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${token}`);

    // Update username
    await prisma.profile.update({
      where: { userId },
      data: { username: 'custom_username' },
    });

    // Re-sync
    const res = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.profile.username).toBe('custom_username');
  });
});
