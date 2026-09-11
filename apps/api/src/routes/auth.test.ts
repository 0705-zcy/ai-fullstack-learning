import { describe, expect, it } from 'vitest';
import { createTestContext, jsonRequest, signUp } from '../test-support/context.js';

const PASSWORD = 'password123';

describe('POST /api/auth/register', () => {
  it('注册成功返回用户信息并下发会话 cookie，且绝不返回密码哈希', async () => {
    const { app } = createTestContext();

    const res = await jsonRequest(app, '/api/auth/register', {
      method: 'POST',
      body: { email: 'New@Example.com', password: PASSWORD, displayName: '小白' },
    });

    expect(res.status).toBe(201);
    const raw = await res.text();
    expect(raw).not.toContain('password');
    expect(raw).not.toContain('scrypt');

    const body = JSON.parse(raw) as { user: { email: string; displayName: string; id: string } };
    expect(body.user.email).toBe('new@example.com'); // 邮箱被规范化
    expect(body.user.displayName).toBe('小白');
    expect(body.user.id).toBeTruthy();

    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('aifs_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('未提供昵称时用邮箱前缀兜底', async () => {
    const { app } = createTestContext();
    const res = await jsonRequest(app, '/api/auth/register', {
      method: 'POST',
      body: { email: 'someone@example.com', password: PASSWORD },
    });

    const body = (await res.json()) as { user: { displayName: string } };
    expect(body.user.displayName).toBe('someone');
  });

  it('邮箱重复返回 409', async () => {
    const { app } = createTestContext();
    await signUp(app, 'dup@example.com', PASSWORD);

    const res = await jsonRequest(app, '/api/auth/register', {
      method: 'POST',
      body: { email: 'dup@example.com', password: PASSWORD },
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('conflict');
  });

  it('密码太短返回 400，并指出是哪个字段', async () => {
    const { app } = createTestContext();
    const res = await jsonRequest(app, '/api/auth/register', {
      method: 'POST',
      body: { email: 'short@example.com', password: '123' },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { details: Array<{ field: string }> } };
    expect(body.error.details.some((d) => d.field === 'password')).toBe(true);
  });

  it('请求体不是合法 JSON 时返回 400 而不是 500', async () => {
    const { app } = createTestContext();
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not json',
    });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('凭正确密码登录成功', async () => {
    const { app } = createTestContext();
    await signUp(app, 'login@example.com', PASSWORD);

    const res = await jsonRequest(app, '/api/auth/login', {
      method: 'POST',
      body: { email: 'login@example.com', password: PASSWORD },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('aifs_session=');
  });

  it('密码错误与邮箱不存在返回同样的提示，避免账号枚举', async () => {
    const { app } = createTestContext();
    await signUp(app, 'real@example.com', PASSWORD);

    const wrongPassword = await jsonRequest(app, '/api/auth/login', {
      method: 'POST',
      body: { email: 'real@example.com', password: 'wrongpassword' },
    });
    const unknownEmail = await jsonRequest(app, '/api/auth/login', {
      method: 'POST',
      body: { email: 'ghost@example.com', password: PASSWORD },
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(await wrongPassword.json()).toEqual(await unknownEmail.json());
  });
});

describe('GET /api/auth/me', () => {
  it('未登录返回 401', async () => {
    const { app } = createTestContext();
    const res = await jsonRequest(app, '/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('带 cookie 时返回当前用户', async () => {
    const { app } = createTestContext();
    const session = await signUp(app, 'me@example.com', PASSWORD, '我');

    const res = await jsonRequest(app, '/api/auth/me', { cookie: session.cookie });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { user: { email: string; displayName: string } };
    expect(body.user.email).toBe('me@example.com');
    expect(body.user.displayName).toBe('我');
  });

  it('伪造的 cookie 返回 401', async () => {
    const { app } = createTestContext();
    const res = await jsonRequest(app, '/api/auth/me', { cookie: 'aifs_session=forged.token.value' });
    expect(res.status).toBe(401);
  });

  it('用户被删除后，旧 cookie 失效并清掉脏 cookie', async () => {
    const { app, db } = createTestContext();
    const session = await signUp(app, 'gone@example.com', PASSWORD);

    db.exec('DELETE FROM users');

    const res = await jsonRequest(app, '/api/auth/me', { cookie: session.cookie });
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie') ?? '').toContain('aifs_session=');
  });
});

describe('POST /api/auth/logout', () => {
  it('清空会话 cookie', async () => {
    const { app } = createTestContext();
    const session = await signUp(app, 'bye@example.com', PASSWORD);

    const res = await jsonRequest(app, '/api/auth/logout', {
      method: 'POST',
      cookie: session.cookie,
    });

    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('aifs_session=');
    expect(cookie.toLowerCase()).toContain('max-age=0');
  });
});
