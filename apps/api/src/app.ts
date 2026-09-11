import { apiErrorBody, toErrorResponse } from './lib/errors.js';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { AppConfig } from './config.js';
import type { Db } from './db/index.js';
import type { AppEnv } from './lib/auth.js';
import { authRoutes } from './routes/auth.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { progressRoutes } from './routes/progress.js';
import { quizRoutes } from './routes/quiz.js';
import { resourceRoutes } from './routes/resources.js';
import { stageRoutes } from './routes/stages.js';

export interface AppDeps {
  db: Db;
  config: AppConfig;
  /** 测试时关掉访问日志，避免污染测试输出。 */
  enableLogger?: boolean;
}

/**
 * 组装 Hono 应用。
 *
 * 依赖（db / config）通过参数注入而不是模块级单例，
 * 这样测试可以直接塞一个内存数据库进来。
 */
export function createApp({ db, config, enableLogger = true }: AppDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.onError((error, c) => toErrorResponse(c, error));

  app.notFound((c) => c.json(apiErrorBody('not_found', '接口不存在'), 404));

  if (enableLogger) {
    app.use('/api/*', logger());
  }

  /**
   * 开发时前端走 Vite 代理（同源），生产时同域部署，一般用不到 CORS。
   * 这里仍显式配置，方便前端直连 8787 调试。
   */
  app.use(
    '/api/*',
    cors({
      origin: config.webOrigin,
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
      maxAge: 86400,
    }),
  );

  app.get('/api/health', (c) => c.json({ ok: true, service: 'aifs-api' }));

  app.route('/api/auth', authRoutes(db, config));
  app.route('/api/stages', stageRoutes(db));
  app.route('/api/resources', resourceRoutes(db));
  app.route('/api/quiz', quizRoutes(db, config));
  app.route('/api/progress', progressRoutes(db, config));
  app.route('/api/dashboard', dashboardRoutes(db, config));

  return app;
}
