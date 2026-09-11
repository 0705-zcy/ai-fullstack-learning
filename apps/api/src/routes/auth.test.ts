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

describe('GET /api/auth/policy', () => {
  it('默认策略是开放注册', async () => {
    const { app } = createTestContext();
    const res = await jsonRequest(app, '/api/auth/policy');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mode: 'open', registrationEnabled: true });
  });

  it('关闭注册时 registrationEnabled 为 false', async () => {
    const { app } = createTestContext({ config: { registrationMode: 'closed' } });
    const body = (await (await jsonRequest(app, '/api/auth/policy')).json()) as {
      mode: string;
      registrationEnabled: boolean;
    };

    expect(body.mode).toBe('closed');
    expect(body.registrationEnabled).toBe(false);
  });

  it('白名单模式如实下发', async () => {
    const { app } = createTestContext({
      config: { registrationMode: 'whitelist', allowedEmails: ['me@example.com'] },
    });
    const body = (await (await jsonRequest(app, '/api/auth/policy')).json()) as {
      mode: string;
      registrationEnabled: boolean;
    };

    expect(body.mode).toBe('whitelist');
    // 白名单模式下注册入口仍然显示（只是提交时才校验）
    expect(body.registrationEnabled).toBe(true);
  });

  it('策略接口不需要登录', async () => {
    const { app } = createTestContext({ config: { registrationMode: 'closed' } });
    expect((await jsonRequest(app, '/api/auth/policy')).status).toBe(200);
  });
});

describe('注册开关', () => {
  it('closed：库为空时放行第一个账号（引导例外）', async () => {
    const { app } = createTestContext({ config: { registrationMode: 'closed' } });

    const res = await jsonRequest(app, '/api/auth/register', {
      method: 'POST',
      body: { email: 'owner@example.com', password: PASSWORD },
    });

    expect(res.status).toBe(201);
  });

  it('closed：已有账号后拒绝新注册，并返回 403', async () => {
    const { app } = createTestContext({ config: { registrationMode: 'closed' } });
    await signUp(app, 'owner@example.com', PASSWORD);

    const res = await jsonRequest(app, '/api/auth/register', {
      method: 'POST',
      body: { email: 'stranger@example.com', password: PASSWORD },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('forbidden');
    expect(body.error.message).toContain('关闭注册');
  });

  it('closed：已存在的账号仍然能正常登录', async () => {
    const { app } = createTestContext({ config: { registrationMode: 'closed' } });
    await signUp(app, 'owner@example.com', PASSWORD);

    const res = await jsonRequest(app, '/api/auth/login', {
      method: 'POST',
      body: { email: 'owner@example.com', password: PASSWORD },
    });

    expect(res.status).toBe(200);
  });

  it('whitelist：名单内可注册，名单外 403', async () => {
    const { app } = createTestContext({
      config: { registrationMode: 'whitelist', allowedEmails: ['me@example.com'] },
    });

    // 引导例外先建一个不在名单里的账号
    await signUp(app, 'bootstrap@example.com', PASSWORD);

    const allowed = await jsonRequest(app, '/api/auth/register', {
      method: 'POST',
      body: { email: 'me@example.com', password: PASSWORD },
    });
    expect(allowed.status).toBe(201);

    const blocked = await jsonRequest(app, '/api/auth/register', {
      method: 'POST',
      body: { email: 'stranger@example.com', password: PASSWORD },
    });
    expect(blocked.status).toBe(403);
  });

  it('open：不受影响，任何人可注册', async () => {
    const { app } = createTestContext();
    await signUp(app, 'first@example.com', PASSWORD);

    const res = await jsonRequest(app, '/api/auth/register', {
      method: 'POST',
      body: { email: 'second@example.com', password: PASSWORD },
    });

    expect(res.status).toBe(201);
  });

  it('被拒绝时不会泄漏邮箱是否已存在（先判权限再查重）', async () => {
    const { app } = createTestContext({ config: { registrationMode: 'closed' } });
    await signUp(app, 'owner@example.com', PASSWORD);

    // 用已存在的邮箱去注册，也应该拿到 403（关闭）而不是 409（已注册）
    const existing = await jsonRequest(app, '/api/auth/register', {
      method: 'POST',
      body: { email: 'owner@example.com', password: PASSWORD },
    });
    const fresh = await jsonRequest(app, '/api/auth/register', {
      method: 'POST',
      body: { email: 'brand-new@example.com', password: PASSWORD },
    });

    expect(existing.status).toBe(403);
    expect(fresh.status).toBe(403);
    expect(await existing.json()).toEqual(await fresh.json());
  });
});
