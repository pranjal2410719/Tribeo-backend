import request from 'supertest';
import app from '../../src/app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Search E2E API (GET /api/v1/search/communities & GET /api/v1/search/people)', () => {
  const ownerId = 'search-owner-id';

  beforeEach(async () => {
    // Seed users/profiles
    await prisma.user.create({
      data: {
        id: ownerId,
        email: 'searchowner@example.com',
        fullName: 'Search Owner',
        profile: {
          create: {
            username: 'search_owner',
            profession: 'Principal Engineer',
            skills: ['NodeJS', 'TypeScript', 'GraphQL'],
            isActive: true,
          },
        },
      },
    });

    await prisma.user.create({
      data: {
        id: 'inactive-user-id',
        email: 'inactive@example.com',
        fullName: 'Inactive Person',
        profile: {
          create: {
            username: 'inactive_user',
            profession: 'Principal Engineer',
            skills: ['NodeJS'],
            isActive: false,
          },
        },
      },
    });

    // Seed communities
    await prisma.community.create({
      data: { name: 'Rust Lovers', slug: 'rust-lovers', category: 'Backend', ownerId },
    });
    await prisma.community.create({
      data: { name: 'Flutter Enthusiasts', slug: 'flutter-enthusiasts', category: 'Mobile', ownerId },
    });
  });

  // Tier 1 Tests
  test('T1.1: Searches communities by name query successfully', async () => {
    const res = await request(app)
      .get('/api/v1/search/communities?q=rust');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].slug).toBe('rust-lovers');
  });

  test('T1.2: Searches communities by category filter successfully', async () => {
    const res = await request(app)
      .get('/api/v1/search/communities?category=Mobile');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].slug).toBe('flutter-enthusiasts');
  });

  test('T1.3: Searches people by username/profession successfully', async () => {
    const res = await request(app)
      .get('/api/v1/search/people?q=Principal');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].username).toBe('search_owner');
  });

  test('T1.4: Searches people by skill successfully', async () => {
    const res = await request(app)
      .get('/api/v1/search/people?skills=GraphQL');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].username).toBe('search_owner');
  });

  test('T1.5: Returns all/recent communities when no query parameter is provided', async () => {
    const res = await request(app)
      .get('/api/v1/search/communities');

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  // Tier 2 Tests (Boundary & Corner Cases)
  test('T2.1: Handles special wildcard characters (%, _) gracefully without errors', async () => {
    const res = await request(app)
      .get('/api/v1/search/communities?q=%25'); // URL-encoded %

    expect(res.status).toBe(200);
  });

  test('T2.2: Verifies case insensitivity of people search queries', async () => {
    const res = await request(app)
      .get('/api/v1/search/people?q=pRiNcIpAl');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].username).toBe('search_owner');
  });

  test('T2.3: Does not return inactive profiles in search results', async () => {
    const res = await request(app)
      .get('/api/v1/search/people?q=inactive_user');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  test('T2.4: Handles multiple skills search queries', async () => {
    const res = await request(app)
      .get('/api/v1/search/people?skills=NodeJS&skills=TypeScript');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].username).toBe('search_owner');
  });

  test('T2.5: Returns an empty array if no match is found for query', async () => {
    const res = await request(app)
      .get('/api/v1/search/people?q=nonexistent_profession');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
