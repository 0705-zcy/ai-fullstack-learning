import { STAGES, resourceQuerySchema } from '@aifs/shared';
import { Hono } from 'hono';
import type { Db } from '../db/index.js';
import { HttpError } from '../lib/errors.js';
import { parseQuery } from '../lib/validate.js';
import { getResource, listResources } from '../repositories/resources.js';

/**
 * 资源库路由：全部是公开读接口，不需要登录。
 */
export function resourceRoutes(db: Db): Hono {
  const app = new Hono();

  /**
   * 资源列表 + 筛选。
   * 除了结果，还返回 facets（各维度的可选值与计数），
   * 让前端不用为了渲染筛选器再发一堆请求。
   */
  app.get('/', (c) => {
    const query = parseQuery(c, resourceQuerySchema);
    const items = listResources(db, query);

    // facets 基于全量数据统计，不受当前筛选影响，避免选项被筛没了点不回去
    const all = listResources(db, {});
    const countBy = <T extends string>(pick: (resource: (typeof all)[number]) => T) => {
      const map = new Map<T, number>();
      for (const resource of all) {
        const key = pick(resource);
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      return map;
    };

    const languageCounts = countBy((r) => r.language);
    const difficultyCounts = countBy((r) => r.difficulty);
    const formatCounts = countBy((r) => r.format);
    const scopeCounts = countBy((r) => r.scope);

    const topics = new Set<string>();
    for (const resource of all) {
      for (const topic of resource.topics) topics.add(topic);
    }

    return c.json({
      items,
      total: items.length,
      facets: {
        total: all.length,
        curriculumCount: all.filter((r) => r.scope === 'curriculum').length,
        stages: STAGES.map((stage) => ({
          id: stage.id,
          title: stage.title,
          count: all.filter((r) => r.stage === stage.id).length,
          curriculumCount: all.filter((r) => r.stage === stage.id && r.scope === 'curriculum')
            .length,
        })),
        languages: [...languageCounts].map(([value, count]) => ({ value, count })),
        difficulties: [...difficultyCounts].map(([value, count]) => ({ value, count })),
        formats: [...formatCounts].map(([value, count]) => ({ value, count })),
        scopes: [...scopeCounts].map(([value, count]) => ({ value, count })),
        topics: [...topics].sort((a, b) => a.localeCompare(b)),
      },
    });
  });

  /** 单个资源详情。 */
  app.get('/:resourceId', (c) => {
    const resource = getResource(db, c.req.param('resourceId'));
    if (!resource) throw HttpError.notFound('找不到这个资源');
    return c.json({ resource });
  });

  return app;
}
