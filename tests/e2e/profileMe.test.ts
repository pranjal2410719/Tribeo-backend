import request from 'supertest';
import { mockAuthUser } from '../utils/authMock';
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

describe('Profile Me E2E API (GET/PUT /api/v1/profiles/me)', () => {
  const token = 'token-profile-me';
  const userId = 'user-profile-me-id';
  const email = 'profileme@example.com';

  beforeEach(async () => {
    mockProfileFindUnique.mockImplementation((args: any, orig: any) => orig(args));
    mockAuthUser(token, userId, email);
    // Seed user and profile
    await prisma.user.create({
      data: {
        id: userId,
        email: email,
        fullName: 'Profile Me Full Name',
        profile: {
          create: {
            username: 'profileme_username',
            bio: 'This is my initial bio.',
            skills: ['NodeJS', 'TypeScript'],
          },
        },
      },
    });
  });

  // Tier 1 Tests
  test('T1.1: Returns 200 and the user profile when authenticated', async () => {
    const res = await request(app)
      .get('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('userId', userId);
    expect(res.body).toHaveProperty('username', 'profileme_username');
    expect(res.body.user).toEqual({ id: userId, email });
  });

  test('T1.2: Returns 401 for GET when unauthenticated', async () => {
    const res = await request(app)
      .get('/api/v1/profiles/me');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'No token provided');
  });

  test('T1.3: Updates profile details successfully and returns 200', async () => {
    const res = await request(app)
      .put('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        bio: 'Updated bio text',
        profession: 'Software Engineer',
        location: 'San Francisco, CA',
        skills: ['NodeJS', 'TypeScript', 'GraphQL'],
      });

    expect(res.status).toBe(200);
    expect(res.body.bio).toBe('Updated bio text');
    expect(res.body.profession).toBe('Software Engineer');
    expect(res.body.location).toBe('San Francisco, CA');
    expect(res.body.skills).toEqual(['NodeJS', 'TypeScript', 'GraphQL']);
  });

  test('T1.4: Returns 401 for PUT when unauthenticated', async () => {
    const res = await request(app)
      .put('/api/v1/profiles/me')
      .send({ bio: 'Hack bio' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'No token provided');
  });

  test('T1.5: Handles internal server error when GET me profile fails', async () => {
    mockProfileFindUnique.mockRejectedValueOnce(new Error('Database error') as never);

    const res = await request(app)
      .get('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error', 'Database error');
  });

  // Tier 2 Tests (Boundary & Corner Cases)
  test('T2.1: Handles updating fields with empty strings and nulls', async () => {
    const res = await request(app)
      .put('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        bio: '',
        profession: null,
        location: null,
      });

    expect(res.status).toBe(200);
    expect(res.body.bio).toBe('');
    expect(res.body.profession).toBeNull();
    expect(res.body.location).toBeNull();
  });

  test('T2.2: Handles exceptionally long bio and skills fields', async () => {
    const longBio = 'B'.repeat(500);
    const manySkills = Array(50).fill('Skill');

    const res = await request(app)
      .put('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        bio: longBio,
        skills: manySkills,
      });

    expect(res.status).toBe(200);
    expect(res.body.bio).toBe(longBio);
    expect(res.body.skills).toHaveLength(50);
  });

  test('T2.3: Safely ignores/processes extra unknown fields in PUT request body', async () => {
    const res = await request(app)
      .put('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        bio: 'Valid bio',
        unknownFieldXYZ: 'some-value',
      });

    expect(res.status).toBe(200);
    expect(res.body.bio).toBe('Valid bio');
    expect(res.body).not.toHaveProperty('unknownFieldXYZ');
  });

  test('T2.4: Updates username to a new valid name successfully', async () => {
    const res = await request(app)
      .put('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        username: 'new_unique_username_123',
      });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('new_unique_username_123');
  });

  test('T2.5: Fails with 500 when attempting to update to a duplicate username', async () => {
    // Seed another user
    await prisma.user.create({
      data: {
        id: 'other-user-id',
        email: 'other@example.com',
        profile: {
          create: {
            username: 'duplicate_name',
          },
        },
      },
    });

    const res = await request(app)
      .put('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        username: 'duplicate_name',
      });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});
