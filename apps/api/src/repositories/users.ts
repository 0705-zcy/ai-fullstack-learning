import { randomUUID } from 'node:crypto';
import type { User } from '@aifs/shared';
import type { Db } from '../db/index.js';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  created_at: string;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
  };
}

export interface UserWithHash extends User {
  passwordHash: string;
}

function toUserWithHash(row: UserRow): UserWithHash {
  return { ...toUser(row), passwordHash: row.password_hash };
}

/** 按邮箱查用户（不区分大小写，邮箱在写入时已规范化）。 */
export function findUserByEmail(db: Db, email: string): UserWithHash | null {
  const row = db
    .prepare('SELECT id, email, password_hash, display_name, created_at FROM users WHERE email = ?')
    .get(email.trim().toLowerCase()) as UserRow | undefined;
  return row ? toUserWithHash(row) : null;
}

/** 按 id 查用户。 */
export function findUserById(db: Db, id: string): User | null {
  const row = db
    .prepare('SELECT id, email, password_hash, display_name, created_at FROM users WHERE id = ?')
    .get(id) as UserRow | undefined;
  return row ? toUser(row) : null;
}

/** 创建用户。邮箱重复会抛错，调用方应先查重。 */
export function createUser(
  db: Db,
  input: { email: string; passwordHash: string; displayName: string },
): User {
  const user: User = {
    id: randomUUID(),
    email: input.email.trim().toLowerCase(),
    displayName: input.displayName,
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO users (id, email, password_hash, display_name, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(user.id, user.email, input.passwordHash, user.displayName, user.createdAt);

  return user;
}
