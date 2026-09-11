import type { User } from '@aifs/shared';
import type { Context, MiddlewareHandler, Next } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import { SESSION_COOKIE, type AppConfig } from '../config.js';
import { HttpError } from './errors.js';
import { findUserById } from '../repositories/users.js';
import type { Db } from '../db/index.js';

export interface AppVariables {
  user: User;
}

export type AppEnv = { Variables: AppVariables };

/** 会话 token 的载荷。 */
interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
  [key: string]: unknown;
}

/** 签发会话 token（HS256）。 */
export async function createSessionToken(
  userId: string,
  config: AppConfig,
  ttlSeconds: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign({ sub: userId, iat: now, exp: now + ttlSeconds }, config.jwtSecret, 'HS256');
}

/** 校验 token，成功返回 userId，失败返回 null（不抛异常，方便中间件分支）。 */
export async function readSessionUserId(
  token: string,
  config: AppConfig,
): Promise<string | null> {
  try {
    // 显式指定 HS256：hono/jwt 的 verify 不接受省略算法，
    // 同时这样也防止算法混淆攻击（攻击者伪造 alg=none 的 token）。
    const payload = (await verify(token, config.jwtSecret, 'HS256')) as SessionPayload;
    return typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}

/** 写会话 cookie：httpOnly + SameSite=Lax，前端 JS 读不到，降低 XSS 窃取风险。 */
export function setSessionCookie(c: Context, token: string, config: AppConfig, ttlSeconds: number): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: config.isProduction,
    path: '/',
    maxAge: ttlSeconds,
  });
}

/** 清除会话 cookie。 */
export function clearSessionCookie(c: Context, config: AppConfig): void {
  deleteCookie(c, SESSION_COOKIE, {
    path: '/',
    secure: config.isProduction,
  });
}

/**
 * 认证中间件：校验 cookie 中的会话，把用户挂到 c.set('user', ...)。
 * 未登录或在 cookie 存在但用户已被删除时返回 401。
 */
export function requireAuth(db: Db, config: AppConfig): MiddlewareHandler<AppEnv> {
  return async (c: Context<AppEnv>, next: Next) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (!token) throw HttpError.unauthorized();

    const userId = await readSessionUserId(token, config);
    if (!userId) throw HttpError.unauthorized('登录已过期，请重新登录');

    const user = findUserById(db, userId);
    if (!user) {
      // token 有效但用户不存在（例如库被重置）：顺手清掉脏 cookie
      clearSessionCookie(c, config);
      throw HttpError.unauthorized('登录已失效，请重新登录');
    }

    c.set('user', user);
    await next();
  };
}
