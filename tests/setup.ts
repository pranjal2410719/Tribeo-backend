import nock from 'nock';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

beforeAll(async () => {
  jest.setTimeout(15000);
  nock.disableNetConnect();
  nock.enableNetConnect(/(127\.0\.0\.1|localhost)/);
});

beforeEach(async () => {
  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Profile", "Community", "Membership", "BanRecord", "Follower" CASCADE;`);
  } catch (err) {
    // Silently ignore or print if verbose
  }
});

afterAll(async () => {
  nock.cleanAll();
  nock.enableNetConnect();
  await prisma.$disconnect();
});
