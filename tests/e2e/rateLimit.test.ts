import request from 'supertest';
import app from '../../src/app';

describe('Rate Limiting E2E', () => {
  test('T1.1: Returns 429 when general rate limit is exceeded', async () => {
    const requests = [];
    for (let i = 0; i < 101; i++) {
      requests.push(request(app).get('/api/v1/health'));
    }

    const results = await Promise.all(requests);
    const statuses = results.map(r => r.status);

    expect(statuses).toContain(200);
    expect(statuses).toContain(429);

    const rateLimited = results.filter(r => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
    expect(rateLimited[0].body).toHaveProperty('error', 'Too many requests, please try again later');
  });

  test('T1.2: Health endpoint works within rate limit', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });

  test('T1.3: Rate limit headers are present', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
    expect(res.headers['ratelimit-reset']).toBeDefined();
  });
});
