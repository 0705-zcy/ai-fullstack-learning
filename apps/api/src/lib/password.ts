import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const PREFIX = 'scrypt';

/**
 * 用 Node 内置 scrypt 派生密码哈希，格式：`scrypt$<saltHex>$<hashHex>`。
 *
 * 不引 bcrypt/argon2 是为了零原生依赖（Windows 上不需要编译工具链）。
 * scrypt 本身就是抗 GPU 的内存硬函数，对 MVP 足够。
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LENGTH);
  return `${PREFIX}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/** 校验密码，恒定时间比较，避免时序侧信道。 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3) return false;

  const [prefix, saltHex, hashHex] = parts;
  if (prefix !== PREFIX || !saltHex || !hashHex) return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (expected.length === 0) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}
