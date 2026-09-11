import { randomUUID } from 'node:crypto';
import type { ProgressEntry, ProgressStatus, QuizAttempt, StageId } from '@aifs/shared';
import type { Db } from '../db/index.js';

interface ProgressRow {
  resource_id: string;
  status: string;
  updated_at: string;
}

interface AttemptRow {
  id: string;
  stage: string;
  score: number;
  total: number;
  created_at: string;
}

/** 某用户全部进度记录。 */
export function listProgress(db: Db, userId: string): ProgressEntry[] {
  const rows = db
    .prepare(
      'SELECT resource_id, status, updated_at FROM progress WHERE user_id = ? ORDER BY updated_at DESC',
    )
    .all(userId) as unknown as ProgressRow[];

  return rows.map((row) => ({
    resourceId: row.resource_id,
    status: row.status as ProgressStatus,
    updatedAt: row.updated_at,
  }));
}

/** 某用户的进度映射：resourceId → status。计算进度时用这个更省事。 */
export function getProgressMap(db: Db, userId: string): Map<string, ProgressStatus> {
  const map = new Map<string, ProgressStatus>();
  for (const entry of listProgress(db, userId)) {
    map.set(entry.resourceId, entry.status);
  }
  return map;
}

/** 写入或更新一条进度。 */
export function setProgress(
  db: Db,
  userId: string,
  resourceId: string,
  status: ProgressStatus,
): ProgressEntry {
  const updatedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO progress (user_id, resource_id, status, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, resource_id) DO UPDATE SET
       status = excluded.status,
       updated_at = excluded.updated_at`,
  ).run(userId, resourceId, status, updatedAt);

  return { resourceId, status, updatedAt };
}

/** 删除一条进度（回到「未开始」）。返回是否真的删掉了。 */
export function clearProgress(db: Db, userId: string, resourceId: string): boolean {
  const result = db
    .prepare('DELETE FROM progress WHERE user_id = ? AND resource_id = ?')
    .run(userId, resourceId);
  return Number(result.changes) > 0;
}

/** 记录一次测验作答。 */
export function recordQuizAttempt(
  db: Db,
  input: {
    userId: string;
    stage: StageId;
    score: number;
    total: number;
    answers: unknown;
  },
): QuizAttempt {
  const attempt: QuizAttempt = {
    id: randomUUID(),
    stage: input.stage,
    score: input.score,
    total: input.total,
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO quiz_attempts (id, user_id, stage, score, total, answers, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    attempt.id,
    input.userId,
    attempt.stage,
    attempt.score,
    attempt.total,
    JSON.stringify(input.answers),
    attempt.createdAt,
  );

  return attempt;
}

/** 每个阶段的历史最好成绩（答对题数）。 */
export function getBestQuizScores(db: Db, userId: string): Map<StageId, number> {
  const rows = db
    .prepare('SELECT stage, MAX(score) AS best FROM quiz_attempts WHERE user_id = ? GROUP BY stage')
    .all(userId) as unknown as Array<{ stage: string; best: number }>;
  return new Map(rows.map((r) => [r.stage as StageId, Number(r.best)]));
}

/** 某用户的测验历史，最新在前。 */
export function listQuizAttempts(db: Db, userId: string, stage?: StageId): QuizAttempt[] {
  const sql = stage
    ? `SELECT id, stage, score, total, created_at FROM quiz_attempts
       WHERE user_id = ? AND stage = ? ORDER BY created_at DESC, rowid DESC`
    : `SELECT id, stage, score, total, created_at FROM quiz_attempts
       WHERE user_id = ? ORDER BY created_at DESC, rowid DESC`;

  const params = stage ? [userId, stage] : [userId];
  const rows = db.prepare(sql).all(...params) as unknown as AttemptRow[];

  return rows.map((row) => ({
    id: row.id,
    stage: row.stage as StageId,
    score: Number(row.score),
    total: Number(row.total),
    createdAt: row.created_at,
  }));
}
