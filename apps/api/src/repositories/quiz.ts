import type { Difficulty, QuizQuestion, StageId } from '@aifs/shared';
import type { Db } from '../db/index.js';

interface QuizRow {
  id: string;
  stage: string;
  prompt: string;
  choices: string;
  answer_index: number;
  explanation: string;
  difficulty: string;
  position: number;
}

/** 不含答案的题目，用于下发给前端。 */
export type PublicQuizQuestion = Omit<QuizQuestion, 'answerIndex' | 'explanation'>;

export function rowToQuestion(row: QuizRow): QuizQuestion {
  let options: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.choices);
    if (Array.isArray(parsed)) options = parsed.map((o) => String(o));
  } catch {
    options = [];
  }

  return {
    id: row.id,
    stage: row.stage as StageId,
    prompt: row.prompt,
    options,
    answerIndex: Number(row.answer_index),
    explanation: row.explanation,
    difficulty: row.difficulty as Difficulty,
  };
}

/** 把题目转成可以安全下发的形式：去掉正确答案与解析。 */
export function toPublicQuestion(question: QuizQuestion): PublicQuizQuestion {
  const { answerIndex: _answerIndex, explanation: _explanation, ...rest } = question;
  return rest;
}

/** 取某阶段的全部题目，按 position 排序。 */
export function listQuestionsByStage(db: Db, stage: StageId): QuizQuestion[] {
  const rows = db
    .prepare(
      `SELECT id, stage, prompt, choices, answer_index, explanation, difficulty, position
       FROM quiz_questions WHERE stage = ? ORDER BY position ASC, id ASC`,
    )
    .all(stage) as unknown as QuizRow[];
  return rows.map(rowToQuestion);
}

/** 取某阶段题目并剥掉答案。 */
export function listPublicQuestionsByStage(db: Db, stage: StageId): PublicQuizQuestion[] {
  return listQuestionsByStage(db, stage).map(toPublicQuestion);
}

/** 取某阶段指定 id 的题目（用于判卷）。 */
export function getQuestionsByIds(db: Db, ids: readonly string[]): Map<string, QuizQuestion> {
  const map = new Map<string, QuizQuestion>();
  if (ids.length === 0) return map;

  const placeholders = ids.map(() => '?').join(', ');
  const rows = db
    .prepare(
      `SELECT id, stage, prompt, choices, answer_index, explanation, difficulty, position
       FROM quiz_questions WHERE id IN (${placeholders})`,
    )
    .all(...ids) as unknown as QuizRow[];

  for (const row of rows) {
    const question = rowToQuestion(row);
    map.set(question.id, question);
  }
  return map;
}

/** 每个阶段的题目总数。 */
export function countQuestionsByStage(db: Db): Map<StageId, number> {
  const rows = db
    .prepare('SELECT stage, COUNT(*) AS n FROM quiz_questions GROUP BY stage')
    .all() as unknown as Array<{ stage: string; n: number }>;
  return new Map(rows.map((r) => [r.stage as StageId, Number(r.n)]));
}

/** 写入/更新题目（种子数据用，幂等）。 */
export function upsertQuestion(db: Db, question: QuizQuestion, position: number): void {
  db.prepare(
    `INSERT INTO quiz_questions
       (id, stage, prompt, choices, answer_index, explanation, difficulty, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       stage = excluded.stage,
       prompt = excluded.prompt,
       choices = excluded.choices,
       answer_index = excluded.answer_index,
       explanation = excluded.explanation,
       difficulty = excluded.difficulty,
       position = excluded.position`,
  ).run(
    question.id,
    question.stage,
    question.prompt,
    JSON.stringify(question.options),
    question.answerIndex,
    question.explanation,
    question.difficulty,
    position,
  );
}
