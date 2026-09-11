import { loginSchema, registerSchema, type AuthPolicy, type User } from '@aifs/shared';
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
import { checkRegistration } from '../lib/registration.js';
import { parseJsonBody } from '../lib/validate.js';
import { countUsers, createUser, findUserByEmail } from '../repositories/users.js';

/**
 * 账号路由：注册 / 登录 / 登出 / 取当前用户 / 取认证策略。
 *
 * 认证方式：httpOnly cookie 里的 JWT。
 * 开发时前端通过 Vite 代理访问 API（同源），因此 SameSite=Lax 即可防住 CSRF。
 *
 * 注册受配置控制（open / closed / whitelist）。这个项目没有邮箱验证、
 * 没有找回密码、也没有速率限制，所以「个人自用」需要一个明确开关，
 * 而不是默认全开再让使用者自己想办法。
 */
export function authRoutes(db: Db, config: AppConfig): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  /** 登录成功后统一签发 cookie。 */
  async function issueSession(c: Parameters<typeof setSessionCookie>[0], user: User) {
    const token = await createSessionToken(user.id, config, SESSION_TTL_SECONDS);
    setSessionCookie(c, token, config, SESSION_TTL_SECONDS);
  }

  /** 公开的认证策略：前端据此决定要不要显示注册入口。 */
  app.get('/policy', (c) => {
    const policy: AuthPolicy = {
      mode: config.registrationMode,
      registrationEnabled: config.registrationMode !== 'closed',
    };
    return c.json(policy);
  });

  app.post('/register', async (c) => {
    const input = await parseJsonBody(c, registerSchema);

    const decision = checkRegistration({
      mode: config.registrationMode,
      allowedEmails: config.allowedEmails,
      email: input.email,
      existingUserCount: countUsers(db),
    });

    if (!decision.allowed) {
      throw HttpError.forbidden(decision.reason);
    }
    if (decision.bootstrapped) {
      console.warn(
        '[api] 库中原本没有任何账号，已放行第一个注册（引导例外）。' +
          '之后的注册将按当前策略执行。',
      );
    }

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
