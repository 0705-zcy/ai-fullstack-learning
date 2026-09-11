import { STAGES, type DashboardSummary } from '@aifs/shared';
import { Hono } from 'hono';
import type { AppConfig } from '../config.js';
import type { Db } from '../db/index.js';
import { buildDashboard } from '../domain/progress.js';
import { requireAuth, type AppEnv } from '../lib/auth.js';
import { countQuestionsByStage } from '../repositories/quiz.js';
import { getBestQuizScores, getProgressMap, listProgress } from '../repositories/progress.js';
import { listResources } from '../repositories/resources.js';

/**
 * 仪表盘聚合接口。
 *
 * 刻意做成「一次请求拿全」：前端打开首页只需要一个请求，
 * 而不是拉 stages + resources + progress + attempts 再自己拼。
 */
export function dashboardRoutes(db: Db, config: AppConfig): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get('/', requireAuth(db, config), (c) => {
    const user = c.get('user');

    const summary: DashboardSummary = buildDashboard(STAGES, {
      user,
      resources: listResources(db, {}),
      progressByResource: getProgressMap(db, user.id),
      recentProgress: listProgress(db, user.id),
      quizTotals: countQuestionsByStage(db),
      quizBestScores: getBestQuizScores(db, user.id),
    });

    return c.json(summary);
  });

  return app;
}
