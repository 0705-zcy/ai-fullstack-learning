import { loginSchema, registerSchema, type User } from '@aifs/shared';
import { Hono } from 'hono';
import type { AppConfig } from '../config.js';
import { SESSION_TTL_SECONDS } from '../config.js';
import type { Db } from '../db/index.js';
import {
  clearSessionCookie,
  createSessionToken,
  requireAuth,
  setSessionCookie,
  type AppEnv,
} from '../lib/auth.js';
import { HttpError } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { parseJsonBody } from '../lib/validate.js';
import { createUser, findUserByEmail } from '../repositories/users.js';

/**
 * 账号路由：注册 / 登录 / 登出 / 取当前用户。
 *
 * 认证方式：httpOnly cookie 里的 JWT。
 * 开发时前端通过 Vite 代理访问 API（同源），因此 SameSite=Lax 即可防住 CSRF。
 */
export function authRoutes(db: Db, config: AppConfig): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  /** 登录成功后统一签发 cookie。 */
  async function issueSession(c: Parameters<typeof setSessionCookie>[0], user: User) {
    const token = await createSessionToken(user.id, config, SESSION_TTL_SECONDS);
    setSessionCookie(c, token, config, SESSION_TTL_SECONDS);
  }

  app.post('/register', async (c) => {
    const input = await parseJsonBody(c, registerSchema);

    if (findUserByEmail(db, input.email)) {
      throw HttpError.conflict('该邮箱已注册，请直接登录');
    }

    const user = createUser(db, {
      email: input.email,
      passwordHash: hashPassword(input.password),
      displayName: input.displayName?.trim() || input.email.split('@')[0] || '学习者',
    });

    await issueSession(c, user);
    return c.json({ user }, 201);
  });

  app.post('/login', async (c) => {
    const input = await parseJsonBody(c, loginSchema);
    const found = findUserByEmail(db, input.email);

    // 邮箱不存在与密码错误返回同一个提示，避免账号枚举。
    if (!found || !verifyPassword(input.password, found.passwordHash)) {
      throw HttpError.unauthorized('邮箱或密码不正确');
    }

    const { passwordHash: _passwordHash, ...user } = found;
    await issueSession(c, user);
    return c.json({ user });
  });

  app.post('/logout', (c) => {
    clearSessionCookie(c, config);
    return c.json({ ok: true });
  });

  app.get('/me', requireAuth(db, config), (c) => {
    return c.json({ user: c.get('user') });
  });

  return app;
}
