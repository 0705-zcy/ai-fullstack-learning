import { isStageId, submitQuizSchema } from '@aifs/shared';
import { Hono } from 'hono';
import type { AppConfig } from '../config.js';
import type { Db } from '../db/index.js';
import { gradeQuiz, isQuizPassed } from '../domain/quiz.js';
import { requireAuth, type AppEnv } from '../lib/auth.js';
import { HttpError } from '../lib/errors.js';
import { parseJsonBody } from '../lib/validate.js';
import {
  getBestQuizScores,
  listQuizAttempts,
  recordQuizAttempt,
} from '../repositories/progress.js';
import { listPublicQuestionsByStage, listQuestionsByStage } from '../repositories/quiz.js';

/**
 * 自测路由。
 *
 * 安全要点：下发给前端的题目**永远不含 answerIndex 和 explanation**，
 * 否则打开 DevTools 就能看到答案，自测也就失去意义了。
 */
export function quizRoutes(db: Db, config: AppConfig): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  function requireStageId(raw: string) {
    if (!isStageId(raw)) throw HttpError.notFound(`未知的阶段：${raw}`);
    return raw;
  }

  /** 取题目（公开，不含答案）。 */
  app.get('/:stage', (c) => {
    const stageId = requireStageId(c.req.param('stage'));
    const questions = listPublicQuestionsByStage(db, stageId);
    return c.json({ stage: stageId, questions, quizTotal: questions.length });
  });

  /** 交卷判分（需要登录，因为要落库到你的账号下）。 */
  app.post('/:stage/submit', requireAuth(db, config), async (c) => {
    const stageId = requireStageId(c.req.param('stage'));
    const input = await parseJsonBody(c, submitQuizSchema);

    if (input.stage !== stageId) {
      throw HttpError.badRequest('请求体中的 stage 与 URL 中的不一致');
    }

    const bank = listQuestionsByStage(db, stageId);
    if (bank.length === 0) {
      throw HttpError.badRequest('这个阶段还没有自测题');
    }

    const summary = gradeQuiz(
      stageId,
      new Map(bank.map((question) => [question.id, question])),
      input.answers,
    );
    const user = c.get('user');

    // total 统一记题库总数，这样历史最好成绩与通过线永远可比
    recordQuizAttempt(db, {
      userId: user.id,
      stage: stageId,
      score: summary.score,
      total: bank.length,
      answers: input.answers,
    });

    const bestScore = getBestQuizScores(db, user.id).get(stageId) ?? summary.score;

    return c.json({
      ...summary,
      bankTotal: bank.length,
      passed: isQuizPassed(summary.score, bank.length),
      bestScore,
    });
  });

  /** 该阶段的作答历史。 */
  app.get('/:stage/attempts', requireAuth(db, config), (c) => {
    const stageId = requireStageId(c.req.param('stage'));
    const user = c.get('user');
    return c.json({ attempts: listQuizAttempts(db, user.id, stageId) });
  });

  return app;
}
