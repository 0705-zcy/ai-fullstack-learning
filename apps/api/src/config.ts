import { resolve } from 'node:path';
import type { RegistrationMode } from '@aifs/shared';
import { parseAllowedEmails, resolveRegistrationMode } from './lib/registration.js';

export interface AppConfig {
  port: number;
  dbPath: string;
  jwtSecret: string;
  isProduction: boolean;
  /** 允许跨域的前端地址（开发时 Vite 代理同源，一般用不到）。 */
  webOrigin: string;
  /** 注册策略：open / closed / whitelist。 */
  registrationMode: RegistrationMode;
  /** 白名单邮箱（仅 whitelist 模式生效）。 */
  allowedEmails: string[];
}

const DEV_SECRET = 'aifs-dev-secret-do-not-use-in-production';

/**
 * 从环境变量读取配置。
 *
 * 刻意不做 dotenv 依赖：直接读 process.env，缺省值让本地开箱即用。
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const isProduction = env.NODE_ENV === 'production';
  const jwtSecret = env.AIFS_JWT_SECRET?.trim() || DEV_SECRET;

  if (isProduction && jwtSecret === DEV_SECRET) {
    throw new Error(
      '生产环境必须设置 AIFS_JWT_SECRET 环境变量，不能使用默认开发密钥。',
    );
  }

  const port = Number.parseInt(env.AIFS_PORT ?? '8787', 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`AIFS_PORT 不是合法端口：${env.AIFS_PORT}`);
  }

  const allowedEmails = parseAllowedEmails(env.AIFS_ALLOWED_EMAILS);
  const registrationMode = resolveRegistrationMode(env.AIFS_REGISTRATION, allowedEmails);

  return {
    port,
    dbPath: env.AIFS_DB_PATH?.trim() || resolve(process.cwd(), 'data', 'aifs.db'),
    jwtSecret,
    isProduction,
    webOrigin: env.AIFS_WEB_ORIGIN?.trim() || 'http://localhost:5173',
    registrationMode,
    allowedEmails,
  };
}

/** 会话 cookie 名称。 */
export const SESSION_COOKIE = 'aifs_session';
/** 会话有效期（秒）。 */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
