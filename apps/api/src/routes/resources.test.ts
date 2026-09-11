import { describe, expect, it } from 'vitest';
import {
  createTestContext,
  jsonRequest,
  makeResource,
  type TestContext,
} from '../test-support/context.js';

interface ListBody {
  items: Array<{ id: string; stage: string; language: string; durationHours: number; topics: string[] }>;
  total: number;
  facets: {
    total: number;
    stages: Array<{ id: string; title: string; count: number }>;
    languages: Array<{ value: string; count: number }>;
    difficulties: Array<{ value: string; count: number }>;
    formats: Array<{ value: string; count: number }>;
    topics: string[];
  };
}

function list(ctx: TestContext, query = ''): Promise<Response> {
  return jsonRequest(ctx.app, `/api/resources${query}`);
}

describe('GET /api/resources', () => {
  it('无需登录即可浏览资源库', async () => {
    const ctx = createTestContext();
    const res = await list(ctx);
    expect(res.status).toBe(200);
  });

  it('返回全部资源与 facets 统计', async () => {
    const ctx = createTestContext();
    const body = (await (await list(ctx)).json()) as ListBody;

    expect(body.total).toBe(12);
    expect(body.facets.total).toBe(12);
    expect(body.facets.stages).toHaveLength(6);
    expect(body.facets.stages.every((s) => s.count === 2)).toBe(true);
    expect(body.facets.languages.map((l) => l.value).sort()).toEqual(['en', 'zh']);
    expect(body.facets.topics).toContain('testing');
  });

  it('可按阶段筛选', async () => {
    const ctx = createTestContext();
    const body = (await (await list(ctx, '?stage=rag')).json()) as ListBody;

    expect(body.total).toBe(2);
    expect(body.items.every((r) => r.stage === 'rag')).toBe(true);
    // facets 是全量统计，不受筛选影响，这样筛选器选项不会被筛没
    expect(body.facets.total).toBe(12);
  });

  it('可按语言与难度筛选', async () => {
    const ctx = createTestContext();

    const zh = (await (await list(ctx, '?language=zh')).json()) as ListBody;
    expect(zh.total).toBe(6);
    expect(zh.items.every((r) => r.language === 'zh')).toBe(true);

    const advanced = (await (await list(ctx, '?difficulty=advanced')).json()) as ListBody;
    expect(advanced.total).toBe(6);
  });

  it('可按最大时长筛选', async () => {
    const ctx = createTestContext();
    const body = (await (await list(ctx, '?maxHours=3')).json()) as ListBody;

    expect(body.total).toBe(6); // 每阶段只有 2h 那个满足
    expect(body.items.every((r) => r.durationHours <= 3)).toBe(true);
  });

  it('关键词可命中标题、提供方与主题', async () => {
    const ctx = createTestContext();

    const byTitle = (await (await list(ctx, '?q=rag-a')).json()) as ListBody;
    expect(byTitle.total).toBe(1);
    expect(byTitle.items[0]?.id).toBe('rag-a');

    const byTopic = (await (await list(ctx, '?q=testing')).json()) as ListBody;
    expect(byTopic.total).toBe(12);
  });

  it('关键词里的 SQL 通配符不会造成意外匹配', async () => {
    const ctx = createTestContext();
    const body = (await (await list(ctx, '?q=%25')).json()) as ListBody;
    // % 被剥离后变成空字符串，不应该匹配到所有记录
    expect(body.total).toBe(0);
  });

  it('排序参数生效，且非法排序值被拒绝', async () => {
    const ctx = createTestContext();

    const asc = (await (await list(ctx, '?sort=duration-asc')).json()) as ListBody;
    const durations = asc.items.map((r) => r.durationHours);
    expect([...durations]).toEqual([...durations].sort((a, b) => a - b));

    expect((await list(ctx, '?sort=DROP%20TABLE')).status).toBe(400);
  });

  it('非法枚举值返回 400 而不是静默忽略', async () => {
    const ctx = createTestContext();
    expect((await list(ctx, '?stage=not-a-stage')).status).toBe(400);
    expect((await list(ctx, '?language=jp')).status).toBe(400);
    expect((await list(ctx, '?maxHours=-5')).status).toBe(400);
  });

  it('空参数的键会被忽略，方便前端直接拼表单值', async () => {
    const ctx = createTestContext();
    const res = await list(ctx, '?stage=&language=&q=');
    expect(res.status).toBe(200);

    const body = (await res.json()) as ListBody;
    expect(body.total).toBe(12);
  });
});

describe('GET /api/resources/:id', () => {
  it('返回单个资源', async () => {
    const ctx = createTestContext();
    const res = await jsonRequest(ctx.app, '/api/resources/rag-a');

    expect(res.status).toBe(200);
    const body = (await res.json()) as { resource: { id: string; stage: string } };
    expect(body.resource.id).toBe('rag-a');
    expect(body.resource.stage).toBe('rag');
  });

  it('不存在的 id 返回 404', async () => {
    const ctx = createTestContext();
    const res = await jsonRequest(ctx.app, '/api/resources/does-not-exist');

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('not_found');
  });

  it('topics 字段在往返数据库后仍然是数组', async () => {
    const ctx = createTestContext({
      resources: [makeResource({ id: 'topic-test', stage: 'rag', topics: ['a', 'b'] })],
    });

    const res = await jsonRequest(ctx.app, '/api/resources/topic-test');
    const body = (await res.json()) as { resource: { topics: string[] } };
    expect(body.resource.topics).toEqual(['a', 'b']);
  });
});
