import nock from 'nock';

const SUPABASE_URL = 'https://pjynycglynfwerripcjp.supabase.co';

export function mockAuthUser(token: string, userId: string, email: string) {
  return nock(SUPABASE_URL)
    .persist()
    .get('/auth/v1/user')
    .matchHeader('authorization', `Bearer ${token}`)
    .reply(200, {
      id: userId,
      email: email,
      aud: 'authenticated',
      role: 'authenticated',
    });
}

export function mockAuthFailure(token: string) {
  return nock(SUPABASE_URL)
    .persist()
    .get('/auth/v1/user')
    .matchHeader('authorization', `Bearer ${token}`)
    .reply(401, {
      error: 'invalid_token',
      error_description: 'Invalid token'
    });
}
