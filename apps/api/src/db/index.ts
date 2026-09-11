import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from './schema.js';

export type Db = DatabaseSync;

/**
 * 打开数据库。`:memory:` 用于测试。
 * 使用 Node 内置的 node:sqlite，不需要任何原生编译依赖。
 */
export function openDatabase(location: string): Db {
  if (location !== ':memory:') {
    mkdirSync(dirname(location), { recursive: true });
  }

  const db = new DatabaseSync(location);
  db.exec('PRAGMA foreign_keys = ON;');
  if (location !== ':memory:') {
    // WAL 提升并发读性能；内存库不支持。
    db.exec('PRAGMA journal_mode = WAL;');
  }
  migrate(db);
  return db;
}

/** 按 PRAGMA user_version 顺序执行未应用的迁移。 */
export function migrate(db: Db): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version?: number } | undefined;
  const current = Number(row?.user_version ?? 0);

  for (let version = current; version < MIGRATIONS.length; version += 1) {
    const sql = MIGRATIONS[version];
    if (!sql) continue;

    db.exec('BEGIN');
    try {
      db.exec(sql);
      // user_version 不支持参数绑定，这里由数组下标产生，是安全的整数。
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw new Error(`数据库迁移 v${version + 1} 失败：${String(error)}`);
    }
  }
}

/** 当前 schema 版本。 */
export function schemaVersion(db: Db): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version?: number } | undefined;
  return Number(row?.user_version ?? 0);
}
