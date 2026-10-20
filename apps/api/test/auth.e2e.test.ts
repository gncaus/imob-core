import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestApp,
  createUser,
  loginAs,
  resetDatabase,
  TEST_PASSWORD,
  type TestApp,
} from './support/test-app.js';

const ADMIN_EMAIL = 'admin@imob.test';

describe('auth', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    await createUser(t.prisma, { email: ADMIN_EMAIL, role: 'ADMIN' });
  });

  describe('POST /auth/login', () => {
    it('sets an httpOnly session cookie and returns the user', async () => {
      const response = await t
        .http()
        .post('/auth/login')
        .send({ email: ' Admin@Imob.TEST ', password: TEST_PASSWORD })
        .expect(200);

      expect(response.body).toEqual({
        user: { id: expect.any(String), name: 'Usuário ADMIN', email: ADMIN_EMAIL, role: 'ADMIN' },
      });
      const [cookie] = response.headers['set-cookie'] as unknown as string[];
      expect(cookie).toMatch(/^imob_session=/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Lax/);
    });

    it('rejects a wrong password with 401', async () => {
      const response = await t
        .http()
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: 'senha-errada' })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('answers an unknown e-mail exactly like a wrong password', async () => {
      const response = await t
        .http()
        .post('/auth/login')
        .send({ email: 'ninguem@imob.test', password: TEST_PASSWORD })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('validates the payload', async () => {
      const response = await t.http().post('/auth/login').send({ email: 'x' }).expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: 'email' })]),
      );
    });
  });

  describe('GET /auth/me', () => {
    it('returns the session user', async () => {
      const cookie = await loginAs(t, ADMIN_EMAIL);

      const response = await t.http().get('/auth/me').set('Cookie', cookie).expect(200);

      expect(response.body.user.email).toBe(ADMIN_EMAIL);
    });

    it('requires a session', async () => {
      const response = await t.http().get('/auth/me').expect(401);

      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects a tampered token', async () => {
      await t.http().get('/auth/me').set('Cookie', 'imob_session=abc.def.ghi').expect(401);
    });

    it('rejects the session of a user that no longer exists', async () => {
      const cookie = await loginAs(t, ADMIN_EMAIL);
      await t.prisma.user.delete({ where: { email: ADMIN_EMAIL } });

      await t.http().get('/auth/me').set('Cookie', cookie).expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('clears the session cookie', async () => {
      const response = await t.http().post('/auth/logout').expect(204);

      const [cookie] = response.headers['set-cookie'] as unknown as string[];
      expect(cookie).toMatch(/^imob_session=;/);
      expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
    });
  });

  it('keeps /health public', async () => {
    await t.http().get('/health').expect(200);
  });
});
