import type { Db } from '../db/index.js';
import { upsertQuestion } from '../repositories/quiz.js';
import { upsertResource } from '../repositories/resources.js';
import { QUIZ_QUESTIONS } from './quizzes.js';
import { RESOURCES } from './resources.js';
import { assertSeedValid } from './validate.js';

export interface SeedResult {
  resources: number;
  questions: number;
}

/**
 * 灌入种子数据（幂等）。
 *
 * 用 upsert 而不是先清空再插入：资源 id 是稳定的，
 * 重新灌数据不会把用户已有的进度记录（外键指向 resource id）删掉。
 */
export function seedDatabase(db: Db): SeedResult {
  assertSeedValid(RESOURCES, QUIZ_QUESTIONS);

  const counters = { resources: 0, questions: 0 };

  db.exec('BEGIN');
  try {
    for (const resource of RESOURCES) {
      upsertResource(db, resource);
      counters.resources += 1;
    }

    const positionByStage = new Map<string, number>();
    for (const question of QUIZ_QUESTIONS) {
      const position = positionByStage.get(question.stage) ?? 0;
      upsertQuestion(db, question, position);
      positionByStage.set(question.stage, position + 1);
      counters.questions += 1;
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return counters;
}

function countRows(db: Db, table: 'resources' | 'quiz_questions'): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number } | undefined;
  return Number(row?.n ?? 0);
}

/**
 * 启动时调用：库里没有资源才灌数据。
 * 让「装完直接能跑」这件事成立，同时不覆盖用户已有的学习进度。
 */
export function ensureSeeded(db: Db): SeedResult & { inserted: boolean } {
  const existing = countRows(db, 'resources');
  if (existing > 0) {
    return { inserted: false, resources: existing, questions: countRows(db, 'quiz_questions') };
  }

  const result = seedDatabase(db);
  return { inserted: true, ...result };
}
