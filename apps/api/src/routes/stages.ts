import { STAGES, STAGE_BY_ID, isStageId } from '@aifs/shared';
import { Hono } from 'hono';
import type { Db } from '../db/index.js';
import { HttpError } from '../lib/errors.js';
import { countQuestionsByStage } from '../repositories/quiz.js';
import { listResources } from '../repositories/resources.js';

/**
 * 阶段（学习路径）路由。阶段定义是静态的，不需要登录即可浏览。
 */
export function stageRoutes(db: Db): Hono {
  const app = new Hono();

  /** 全部阶段，按学习顺序。 */
  app.get('/', (c) => {
    return c.json({ stages: STAGES });
  });

  /** 单个阶段详情：元数据 + 该阶段的全部资源 + 题目数量。 */
  app.get('/:stageId', (c) => {
    const stageId = c.req.param('stageId');
    if (!isStageId(stageId)) {
      throw HttpError.notFound(`未知的阶段：${stageId}`);
    }

    const quizTotals = countQuestionsByStage(db);
    const resources = listResources(db, { stage: stageId });

    return c.json({
      stage: STAGE_BY_ID[stageId],
      resources,
      quizTotal: quizTotals.get(stageId) ?? 0,
    });
  });

  return app;
}
