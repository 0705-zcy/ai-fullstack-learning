import { setProgressSchema } from '@aifs/shared';
import { Hono } from 'hono';
import type { AppConfig } from '../config.js';
import type { Db } from '../db/index.js';
import { requireAuth, type AppEnv } from '../lib/auth.js';
import { HttpError } from '../lib/errors.js';
import { parseJsonBody } from '../lib/validate.js';
import { clearProgress, listProgress, setProgress } from '../repositories/progress.js';
import { getResource } from '../repositories/resources.js';

/**
 * 进度路由。全部需要登录——进度是账号资产，云端同步就体现在这里。
 */
export function progressRoutes(db: Db, config: AppConfig): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', requireAuth(db, config));

  /** 拉取当前用户的全部进度记录。 */
  app.get('/', (c) => {
    const user = c.get('user');
    return c.json({ entries: listProgress(db, user.id) });
  });

  /** 设置（或更新）某个资源的学习状态。 */
  app.put('/', async (c) => {
    const input = await parseJsonBody(c, setProgressSchema);
    const user = c.get('user');

    // 外键约束会在插入时报错，但那样错误信息对用户没意义，先显式校验
    if (!getResource(db, input.resourceId)) {
      throw HttpError.notFound('找不到这个资源，无法记录进度');
    }

    const entry = setProgress(db, user.id, input.resourceId, input.status);
    return c.json({ entry });
  });

  /** 取消记录，回到「未开始」。 */
  app.delete('/:resourceId', (c) => {
    const user = c.get('user');
    const cleared = clearProgress(db, user.id, c.req.param('resourceId'));
    if (!cleared) throw HttpError.notFound('这条进度记录不存在');
    return c.json({ ok: true });
  });

  return app;
}
