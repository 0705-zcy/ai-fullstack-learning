import type {
  Difficulty,
  LanguageCode,
  Resource,
  ResourceFormat,
  ResourceScope,
  StageId,
} from '@aifs/shared';
import type { Db } from '../db/index.js';

interface ResourceRow {
  id: string;
  title: string;
  url: string;
  provider: string;
  language: string;
  difficulty: string;
  format: string;
  duration_hours: number;
  topics: string;
  stage: string;
  scope: string;
  description: string;
  notes: string;
  verified: number;
}

/** 把数据库行转成领域对象。JSON 字段解析失败时降级为空数组，不让脏数据打挂接口。 */
export function rowToResource(row: ResourceRow): Resource {
  let topics: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.topics);
    if (Array.isArray(parsed)) topics = parsed.map((t) => String(t));
  } catch {
    topics = [];
  }

  return {
    id: row.id,
    title: row.title,
    url: row.url,
    provider: row.provider,
    language: row.language as LanguageCode,
    difficulty: row.difficulty as Difficulty,
    format: row.format as ResourceFormat,
    durationHours: Number(row.duration_hours),
    topics,
    stage: row.stage as StageId,
    // 老数据可能没有 scope（迁移默认给了 supplement），这里再兜一层
    scope: (row.scope === 'curriculum' ? 'curriculum' : 'supplement') as ResourceScope,
    description: row.description,
    notes: row.notes,
    verified: Number(row.verified) === 1,
  };
}

const SELECT_COLUMNS = `
  id, title, url, provider, language, difficulty, format,
  duration_hours, topics, stage, scope, description, notes, verified
`;

export interface ResourceFilter {
  stage?: StageId;
  language?: LanguageCode;
  difficulty?: Difficulty;
  format?: ResourceFormat;
  scope?: ResourceScope;
  q?: string;
  maxHours?: number;
  sort?: 'default' | 'duration-asc' | 'duration-desc' | 'title';
}

/**
 * 按条件筛选资源。
 *
 * 用 SQL 动态拼 WHERE，但**所有值都走参数绑定**，不做字符串插值，
 * 排序字段用白名单映射，避免注入。
 */
export function listResources(db: Db, filter: ResourceFilter = {}): Resource[] {
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (filter.stage) {
    clauses.push('stage = ?');
    params.push(filter.stage);
  }
  if (filter.language) {
    clauses.push('language = ?');
    params.push(filter.language);
  }
  if (filter.difficulty) {
    clauses.push('difficulty = ?');
    params.push(filter.difficulty);
  }
  if (filter.format) {
    clauses.push('format = ?');
    params.push(filter.format);
  }
  if (filter.scope) {
    clauses.push('scope = ?');
    params.push(filter.scope);
  }
  if (typeof filter.maxHours === 'number') {
    clauses.push('duration_hours <= ?');
    params.push(filter.maxHours);
  }
  if (filter.q) {
    // 标题/提供方/描述/主题 的宽松匹配。
    // LIKE 的 % 和 _ 是通配符，用户输入里出现时必须转义成字面量，
    // 否则搜「%」会匹配到所有记录，搜「_」同理。
    clauses.push(
      `(title LIKE ? ESCAPE '\\' OR provider LIKE ? ESCAPE '\\'
        OR description LIKE ? ESCAPE '\\' OR topics LIKE ? ESCAPE '\\')`,
    );
    const escaped = filter.q.replace(/[\\%_]/g, (ch) => `\\${ch}`);
    const like = `%${escaped}%`;
    params.push(like, like, like, like);
  }

  const orderBy = (() => {
    switch (filter.sort) {
      case 'duration-asc':
        return 'duration_hours ASC, title ASC';
      case 'duration-desc':
        return 'duration_hours DESC, title ASC';
      case 'title':
        return 'title ASC';
      default:
        // 默认排序即「按学习路径该先看什么」：
        // 阶段顺序 → **完整体系课优先** → 难度从易到难 → 时长。
        // 体系课排前面是刻意的：用户最需要的是能走完的路，而不是一堆碎片。
        return `CASE stage
            WHEN 'foundation' THEN 1 WHEN 'llm-core' THEN 2 WHEN 'rag' THEN 3
            WHEN 'agent' THEN 4 WHEN 'engineering' THEN 5 WHEN 'capstone' THEN 6
            ELSE 99 END ASC,
          CASE scope WHEN 'curriculum' THEN 0 ELSE 1 END ASC,
          CASE difficulty WHEN 'beginner' THEN 1 WHEN 'intermediate' THEN 2 ELSE 3 END ASC,
          duration_hours ASC`;
    }
  })();

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM resources ${where} ORDER BY ${orderBy}`)
    .all(...params) as unknown as ResourceRow[];

  return rows.map(rowToResource);
}

/** 按 id 取单个资源。 */
export function getResource(db: Db, id: string): Resource | null {
  const row = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM resources WHERE id = ?`)
    .get(id) as ResourceRow | undefined;
  return row ? rowToResource(row) : null;
}

/** 按 id 批量取资源，返回 id → Resource 映射。 */
export function getResourcesByIds(db: Db, ids: readonly string[]): Map<string, Resource> {
  const map = new Map<string, Resource>();
  if (ids.length === 0) return map;

  const placeholders = ids.map(() => '?').join(', ');
  const rows = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM resources WHERE id IN (${placeholders})`)
    .all(...ids) as unknown as ResourceRow[];

  for (const row of rows) {
    const resource = rowToResource(row);
    map.set(resource.id, resource);
  }
  return map;
}

/** 统计每个阶段的资源数量。 */
export function countResourcesByStage(db: Db): Map<StageId, number> {
  const rows = db
    .prepare('SELECT stage, COUNT(*) AS n FROM resources GROUP BY stage')
    .all() as unknown as Array<{ stage: string; n: number }>;
  return new Map(rows.map((r) => [r.stage as StageId, Number(r.n)]));
}

/** 写入/更新资源（种子数据用，幂等）。 */
export function upsertResource(db: Db, resource: Resource): void {
  db.prepare(
    `INSERT INTO resources
       (id, title, url, provider, language, difficulty, format,
        duration_hours, topics, stage, scope, description, notes, verified)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       url = excluded.url,
       provider = excluded.provider,
       language = excluded.language,
       difficulty = excluded.difficulty,
       format = excluded.format,
       duration_hours = excluded.duration_hours,
       topics = excluded.topics,
       stage = excluded.stage,
       scope = excluded.scope,
       description = excluded.description,
       notes = excluded.notes,
       verified = excluded.verified`,
  ).run(
    resource.id,
    resource.title,
    resource.url,
    resource.provider,
    resource.language,
    resource.difficulty,
    resource.format,
    resource.durationHours,
    JSON.stringify(resource.topics),
    resource.stage,
    resource.scope,
    resource.description,
    resource.notes,
    resource.verified ? 1 : 0,
  );
}
