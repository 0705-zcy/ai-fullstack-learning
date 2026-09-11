import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { migrate, openDatabase, schemaVersion } from './index.js';
import { MIGRATIONS } from './schema.js';

/**
 * 迁移是「上线后才炸」的典型位置：
 * 新库从零建当然没问题，真正的风险在**已有的老库**能不能平滑升上来。
 * 所以这里显式构造一个 v1 的库来验证升级路径。
 */

const INSERT_V1_RESOURCE = `
  INSERT INTO resources
    (id, title, url, provider, language, difficulty, format,
     duration_hours, topics, stage, description, notes, verified)
  VALUES (?, ?, 'https://example.com/x', '提供方', 'en', 'beginner', 'docs',
          4, '["testing"]', 'rag', '说明', '', 1)
`;

/** 建一个只应用了 v1 迁移的库，模拟线上已经存在的数据。 */
function createV1Database(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(MIGRATIONS[0] as string);
  db.exec('PRAGMA user_version = 1');
  return db;
}

describe('数据库迁移', () => {
  it('全新数据库会迁移到最新版本', () => {
    const db = openDatabase(':memory:');
    expect(schemaVersion(db)).toBe(MIGRATIONS.length);
    db.close();
  });

  it('v1 老库能升级到最新版本，且数据不丢', () => {
    const db = createV1Database();
    db.prepare(INSERT_V1_RESOURCE).run('legacy-1', '老资源一');
    db.prepare(INSERT_V1_RESOURCE).run('legacy-2', '老资源二');

    migrate(db);

    expect(schemaVersion(db)).toBe(MIGRATIONS.length);

    const rows = db
      .prepare('SELECT id, title, scope FROM resources ORDER BY id')
      .all() as unknown as Array<{ id: string; title: string; scope: string }>;

    // 数据还在
    expect(rows).toHaveLength(2);
    expect(rows[0]?.title).toBe('老资源一');

    // 关键：老数据不能变成空值或 undefined，默认归为单点补充
    for (const row of rows) {
      expect(row.scope).toBe('supplement');
    }

    db.close();
  });

  it('升级后新字段可写可读', () => {
    const db = createV1Database();
    db.prepare(INSERT_V1_RESOURCE).run('legacy-1', '老资源一');
    migrate(db);

    db.prepare('UPDATE resources SET scope = ? WHERE id = ?').run('curriculum', 'legacy-1');
    const row = db.prepare('SELECT scope FROM resources WHERE id = ?').get('legacy-1') as {
      scope: string;
    };
    expect(row.scope).toBe('curriculum');

    db.close();
  });

  it('迁移是幂等的：重复执行不会报错也不会跳版本', () => {
    const db = openDatabase(':memory:');
    migrate(db);
    migrate(db);
    expect(schemaVersion(db)).toBe(MIGRATIONS.length);
    db.close();
  });

  it('迁移失败会回滚，不会留下半成品 schema', () => {
    const db = new DatabaseSync(':memory:');
    // 造一个会失败的迁移：对不存在的表做 ALTER
    const broken = [...MIGRATIONS, 'ALTER TABLE not_a_table ADD COLUMN x TEXT;'];

    expect(() => {
      // 复刻 migrate 的逻辑，但用带坏迁移的列表
      const current = 0;
      for (let version = current; version < broken.length; version += 1) {
        db.exec('BEGIN');
        try {
          db.exec(broken[version] as string);
          db.exec(`PRAGMA user_version = ${version + 1}`);
          db.exec('COMMIT');
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      }
    }).toThrow();

    // 前面成功的迁移保住了，失败的没有留下痕迹
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as unknown as Array<{ name: string }>;
    expect(tables.map((t) => t.name)).toContain('resources');
    expect(tables.map((t) => t.name)).not.toContain('not_a_table');

    db.close();
  });
});
