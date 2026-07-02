import request from 'supertest';
import app from '../../src/app';
import { mockAuthUser } from '../utils/authMock';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Tier 4: Real-World Application Scenarios', () => {
  // Scenario 1: Onboarding and Platform Entry
  test('Scenario 1: The Onboarding and Platform Entry (Auth Sync -> Profile Me -> Search)', async () => {
    const token = 'onboard-token';
    const userId = 'onboard-user-id';
    const email = 'newdev@example.com';
    mockAuthUser(token, userId, email);

    // 1. User signs in first time (Auth Sync)
    const syncRes = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${token}`);
    expect(syncRes.status).toBe(201);
    expect(syncRes.body.email).toBe(email);

    // 2. User updates profile with details
    const updateRes = await request(app)
      .put('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        profession: 'Frontend Engineer',
        location: 'Berlin, Germany',
        skills: ['React', 'TypeScript'],
      });
    expect(updateRes.status).toBe(200);

    // 3. User browses existing communities on the platform (Search)
    const searchRes = await request(app)
      .get('/api/v1/search/communities?q=');
    expect(searchRes.status).toBe(200);
    expect(searchRes.body).toBeInstanceOf(Array);
  });

  // Scenario 2: Community Creator Journey
  test('Scenario 2: Community Creator Journey (Auth Sync -> Create Comm -> Update Comm -> Search)', async () => {
    const token = 'creator-token';
    const userId = 'creator-user-id';
    const email = 'creator@example.com';
    mockAuthUser(token, userId, email);

    // 1. Sync creator user
    await request(app).post('/api/v1/auth/sync').set('Authorization', `Bearer ${token}`);

    // 2. Create a community
    const createRes = await request(app)
      .post('/api/v1/communities')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Solidity Devs',
        description: 'Web3 developers group.',
        category: 'Blockchain',
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.slug).toBe('solidity-devs');

    // 3. Update community guidelines
    const updateRes = await request(app)
      .put('/api/v1/communities/solidity-devs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        rules: 'No spamming. Technical discussion only.',
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.rules).toBe('No spamming. Technical discussion only.');

    // 4. Search for the community to verify public index works
    const searchRes = await request(app)
      .get('/api/v1/search/communities?q=solidity');
    expect(searchRes.status).toBe(200);
    expect(searchRes.body).toHaveLength(1);
    expect(searchRes.body[0].slug).toBe('solidity-devs');
  });

  // Scenario 3: The Collaboration Hub
  test('Scenario 3: The Collaboration Hub (Creator Creates -> User Joins -> Member & Profile Check)', async () => {
    const ownerToken = 'coll-owner-token';
    const ownerId = 'coll-owner-id';
    const ownerEmail = 'collowner@example.com';

    const devToken = 'coll-dev-token';
    const devId = 'coll-dev-id';
    const devEmail = 'colldev@example.com';

    mockAuthUser(ownerToken, ownerId, ownerEmail);
    mockAuthUser(devToken, devId, devEmail);

    // 1. Owner logs in and creates community
    await request(app).post('/api/v1/auth/sync').set('Authorization', `Bearer ${ownerToken}`);
    const commRes = await request(app)
      .post('/api/v1/communities')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Collaboration Station', description: 'Co-work community.' });
    expect(commRes.status).toBe(201);

    // 2. Dev logs in and updates profile
    const devSync = await request(app).post('/api/v1/auth/sync').set('Authorization', `Bearer ${devToken}`);
    const devUsername = devSync.body.profile.username;
    await request(app)
      .put('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${devToken}`)
      .send({ skills: ['Co-Working'] });

    // 3. Dev joins collaboration community
    const joinRes = await request(app)
      .post('/api/v1/communities/collaboration-station/join')
      .set('Authorization', `Bearer ${devToken}`);
    expect(joinRes.status).toBe(201);
    expect(joinRes.body.status).toBe('APPROVED');

    // 4. Verify dev is listed under community members
    const membersRes = await request(app)
      .get('/api/v1/communities/collaboration-station/members');
    const memberUserIds = membersRes.body.map((m: any) => m.userId);
    expect(memberUserIds).toContain(devId);

    // 5. Verify dev public profile shows the membership
    const profileRes = await request(app)
      .get(`/api/v1/profiles/${devUsername}`);
    expect(profileRes.body.memberships).toHaveLength(1);
    expect(profileRes.body.memberships[0].community.slug).toBe('collaboration-station');
  });

  // Scenario 4: Moderation and Access Control
  test('Scenario 4: Moderation and Access Control (Private Comm -> Join Pending -> Members Check -> Leave)', async () => {
    const ownerToken = 'mod-owner-token';
    const ownerId = 'mod-owner-id';
    const ownerEmail = 'modowner@example.com';

    const applicantToken = 'mod-app-token';
    const applicantId = 'mod-app-id';
    const applicantEmail = 'modapp@example.com';

    mockAuthUser(ownerToken, ownerId, ownerEmail);
    mockAuthUser(applicantToken, applicantId, applicantEmail);

    // 1. Create a private community
    await request(app).post('/api/v1/auth/sync').set('Authorization', `Bearer ${ownerToken}`);
    await request(app)
      .post('/api/v1/communities')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Private Secret Club', description: 'Secret group.', visibility: 'PRIVATE' });

    // 2. Applicant signs in and requests to join
    await request(app).post('/api/v1/auth/sync').set('Authorization', `Bearer ${applicantToken}`);
    const joinRes = await request(app)
      .post('/api/v1/communities/private-secret-club/join')
      .set('Authorization', `Bearer ${applicantToken}`);
    expect(joinRes.status).toBe(201);
    expect(joinRes.body.status).toBe('PENDING');

    // 3. Verify applicant is NOT visible in public members list
    const membersRes = await request(app)
      .get('/api/v1/communities/private-secret-club/members');
    const approvedMemberIds = membersRes.body.map((m: any) => m.userId);
    expect(approvedMemberIds).not.toContain(applicantId);

    // 4. Applicant decides to leave/cancel request
    const leaveRes = await request(app)
      .delete('/api/v1/communities/private-secret-club/leave')
      .set('Authorization', `Bearer ${applicantToken}`);
    expect(leaveRes.status).toBe(204);

    // 5. Verify request is completely removed from DB
    const dbMembership = await prisma.membership.findFirst({
      where: { userId: applicantId },
    });
    expect(dbMembership).toBeNull();
  });

  // Scenario 5: The Talent Discovery
  test('Scenario 5: The Talent Discovery (Talent Profile -> Skill Search -> Public Profile View)', async () => {
    const talentToken = 'talent-token';
    const talentId = 'talent-id';
    const talentEmail = 'talent@example.com';

    const recruiterToken = 'recruiter-token';
    const recruiterId = 'recruiter-id';
    const recruiterEmail = 'recruiter@example.com';

    mockAuthUser(talentToken, talentId, talentEmail);
    mockAuthUser(recruiterToken, recruiterId, recruiterEmail);

    // 1. Talent signs up and sets up skills & location
    const talentSync = await request(app).post('/api/v1/auth/sync').set('Authorization', `Bearer ${talentToken}`);
    const talentUsername = talentSync.body.profile.username;

    await request(app)
      .put('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${talentToken}`)
      .send({
        fullName: 'Talent Developer',
        profession: 'Svelte Specialist',
        location: 'London, UK',
        skills: ['Svelte', 'Docker'],
      });

    // 2. Recruiter signs up and searches for talent with 'Svelte' skill
    await request(app).post('/api/v1/auth/sync').set('Authorization', `Bearer ${recruiterToken}`);
    const searchRes = await request(app)
      .get('/api/v1/search/people?skills=Svelte');
    expect(searchRes.status).toBe(200);

    const matches = searchRes.body.map((p: any) => p.username);
    expect(matches).toContain(talentUsername);

    // 3. Recruiter views talent public profile to read bio/details
    const profileRes = await request(app)
      .get(`/api/v1/profiles/${talentUsername}`);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.profession).toBe('Svelte Specialist');
    expect(profileRes.body.location).toBe('London, UK');
    expect(profileRes.body.skills).toContain('Docker');
  });
});
