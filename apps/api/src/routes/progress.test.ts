import { QUIZ_QUESTIONS } from '../seed/quizzes.js';
import { describe, expect, it } from 'vitest';
import { createTestContext, jsonRequest, signUp } from '../test-support/context.js';

interface DashboardBody {
  user: { email: string };
  stages: Array<{
    stage: { id: string; title: string };
    totalResources: number;
    completedResources: number;
    quizTotal: number;
    quizBestScore: number;
    unlocked: boolean;
    completed: boolean;
    completion: number;
  }>;
  overall: {
    totalResources: number;
    completedResources: number;
    completion: number;
    completedStages: number;
    estimatedHoursSpent: number;
  };
  currentStage: string | null;
  continueLearning: { id: string; title: string } | null;
}

describe('进度接口的鉴权', () => {
  it('未登录时所有进度接口都返回 401', async () => {
    const ctx = createTestContext();

    expect((await jsonRequest(ctx.app, '/api/progress')).status).toBe(401);
    expect(
      (await jsonRequest(ctx.app, '/api/progress', {
        method: 'PUT',
        body: { resourceId: 'rag-a', status: 'completed' },
      })).status,
    ).toBe(401);
    expect((await jsonRequest(ctx.app, '/api/progress/rag-a', { method: 'DELETE' })).status).toBe(401);
    expect((await jsonRequest(ctx.app, '/api/dashboard')).status).toBe(401);
  });
});

describe('PUT /api/progress', () => {
  it('记录资源状态并可通过 GET 读回', async () => {
    const ctx = createTestContext();
    const session = await signUp(ctx.app);

    const put = await jsonRequest(ctx.app, '/api/progress', {
      method: 'PUT',
      cookie: session.cookie,
      body: { resourceId: 'rag-a', status: 'learning' },
    });

    expect(put.status).toBe(200);
    const entry = (await put.json()) as { entry: { resourceId: string; status: string } };
    expect(entry.entry.resourceId).toBe('rag-a');
    expect(entry.entry.status).toBe('learning');

    const list = await jsonRequest(ctx.app, '/api/progress', { cookie: session.cookie });
    const body = (await list.json()) as { entries: Array<{ resourceId: string; status: string }> };
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0]?.status).toBe('learning');
  });

  it('重复 PUT 同一个资源是更新而不是插入', async () => {
    const ctx = createTestContext();
    const session = await signUp(ctx.app);

    await jsonRequest(ctx.app, '/api/progress', {
      method: 'PUT',
      cookie: session.cookie,
      body: { resourceId: 'rag-a', status: 'wishlist' },
    });
    await jsonRequest(ctx.app, '/api/progress', {
      method: 'PUT',
      cookie: session.cookie,
      body: { resourceId: 'rag-a', status: 'completed' },
    });

    const list = await jsonRequest(ctx.app, '/api/progress', { cookie: session.cookie });
    const body = (await list.json()) as { entries: Array<{ resourceId: string; status: string }> };

    expect(body.entries).toHaveLength(1);
    expect(body.entries[0]?.status).toBe('completed');
  });

  it('不存在的资源 id 返回 404', async () => {
    const ctx = createTestContext();
    const session = await signUp(ctx.app);

    const res = await jsonRequest(ctx.app, '/api/progress', {
      method: 'PUT',
      cookie: session.cookie,
      body: { resourceId: 'ghost', status: 'completed' },
    });

    expect(res.status).toBe(404);
  });

  it('非法状态值返回 400', async () => {
    const ctx = createTestContext();
    const session = await signUp(ctx.app);

    const res = await jsonRequest(ctx.app, '/api/progress', {
      method: 'PUT',
      cookie: session.cookie,
      body: { resourceId: 'rag-a', status: 'finished' },
    });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/progress/:resourceId', () => {
  it('删除后回到「未开始」', async () => {
    const ctx = createTestContext();
    const session = await signUp(ctx.app);

    await jsonRequest(ctx.app, '/api/progress', {
      method: 'PUT',
      cookie: session.cookie,
      body: { resourceId: 'rag-a', status: 'completed' },
    });

    const del = await jsonRequest(ctx.app, '/api/progress/rag-a', {
      method: 'DELETE',
      cookie: session.cookie,
    });
    expect(del.status).toBe(200);

    const list = await jsonRequest(ctx.app, '/api/progress', { cookie: session.cookie });
    const body = (await list.json()) as { entries: unknown[] };
    expect(body.entries).toHaveLength(0);
  });

  it('删除不存在的记录返回 404', async () => {
    const ctx = createTestContext();
    const session = await signUp(ctx.app);

    const res = await jsonRequest(ctx.app, '/api/progress/rag-a', {
      method: 'DELETE',
      cookie: session.cookie,
    });
    expect(res.status).toBe(404);
  });
});

describe('进度是按用户隔离的', () => {
  it('A 用户的进度不会出现在 B 用户的仪表盘里', async () => {
    const ctx = createTestContext();
    const alice = await signUp(ctx.app, 'alice@example.com');
    const bob = await signUp(ctx.app, 'bob@example.com');

    await jsonRequest(ctx.app, '/api/progress', {
      method: 'PUT',
      cookie: alice.cookie,
      body: { resourceId: 'rag-a', status: 'completed' },
    });

    const bobDashboard = await jsonRequest(ctx.app, '/api/dashboard', { cookie: bob.cookie });
    const body = (await bobDashboard.json()) as DashboardBody;

    expect(body.user.email).toBe('bob@example.com');
    expect(body.overall.completedResources).toBe(0);
  });
});

describe('GET /api/dashboard', () => {
  it('新用户：拿到 6 个阶段，只有第一个解锁，进度全为 0', async () => {
    const ctx = createTestContext();
    const session = await signUp(ctx.app);

    const res = await jsonRequest(ctx.app, '/api/dashboard', { cookie: session.cookie });
    expect(res.status).toBe(200);

    const body = (await res.json()) as DashboardBody;
    expect(body.stages).toHaveLength(6);
    expect(body.stages[0]?.stage.id).toBe('foundation');
    expect(body.stages[0]?.unlocked).toBe(true);
    expect(body.stages[0]?.completed).toBe(false);
    expect(body.stages[1]?.unlocked).toBe(false);
    expect(body.overall.totalResources).toBe(18);
    expect(body.overall.completion).toBe(0);
    expect(body.overall.completedStages).toBe(0);
    expect(body.currentStage).toBe('foundation');
  });

  it('题库数量会体现在每个阶段上', async () => {
    const ctx = createTestContext();
    const session = await signUp(ctx.app);

    const res = await jsonRequest(ctx.app, '/api/dashboard', { cookie: session.cookie });
    const body = (await res.json()) as DashboardBody;

    for (const stage of body.stages) {
      const expected = QUIZ_QUESTIONS.filter((q) => q.stage === stage.stage.id).length;
      expect(stage.quizTotal).toBe(expected);
    }
  });

  it('完成第一个阶段的资源与自测后，阶段标记完成并解锁下一阶段', async () => {
    const ctx = createTestContext();
    const session = await signUp(ctx.app);

    for (const resourceId of ['foundation-a', 'foundation-b', 'foundation-c']) {
      await jsonRequest(ctx.app, '/api/progress', {
        method: 'PUT',
        cookie: session.cookie,
        body: { resourceId, status: 'completed' },
      });
    }

    const bank = QUIZ_QUESTIONS.filter((q) => q.stage === 'foundation');
    await jsonRequest(ctx.app, '/api/quiz/foundation/submit', {
      method: 'POST',
      cookie: session.cookie,
      body: { stage: 'foundation', answers: bank.map((q) => ({ questionId: q.id, optionIndex: q.answerIndex })) },
    });

    // foundation-a 是 2h，foundation-b 是 8h，foundation-c 是 12h
    const res = await jsonRequest(ctx.app, '/api/dashboard', { cookie: session.cookie });
    const body = (await res.json()) as DashboardBody;

    const foundation = body.stages[0];
    expect(foundation?.completed).toBe(true);
    expect(foundation?.completion).toBe(1);
    expect(foundation?.quizBestScore).toBe(bank.length);
    expect(body.stages[1]?.unlocked).toBe(true);
    expect(body.currentStage).toBe('llm-core');
    expect(body.overall.completedStages).toBe(1);
    expect(body.overall.estimatedHoursSpent).toBe(22);
  });

  it('continueLearning 会推荐最近标记为「在学」的资源', async () => {
    const ctx = createTestContext();
    const session = await signUp(ctx.app);

    await jsonRequest(ctx.app, '/api/progress', {
      method: 'PUT',
      cookie: session.cookie,
      body: { resourceId: 'rag-b', status: 'learning' },
    });

    const res = await jsonRequest(ctx.app, '/api/dashboard', { cookie: session.cookie });
    const body = (await res.json()) as DashboardBody;

    expect(body.continueLearning?.id).toBe('rag-b');
  });

  it('没有在学资源时，推荐当前阶段最短的未完成资源', async () => {
    const ctx = createTestContext();
    const session = await signUp(ctx.app);

    const res = await jsonRequest(ctx.app, '/api/dashboard', { cookie: session.cookie });
    const body = (await res.json()) as DashboardBody;

    expect(body.continueLearning?.id).toBe('foundation-a'); // 2h vs 8h
  });

  it('仪表盘不回传密码哈希', async () => {
    const ctx = createTestContext();
    const session = await signUp(ctx.app);

    const res = await jsonRequest(ctx.app, '/api/dashboard', { cookie: session.cookie });
    const raw = await res.text();

    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('password_hash');
    expect(raw).not.toContain('scrypt');
  });
});

describe('通用行为', () => {
  it('未知接口返回统一的 404 结构', async () => {
    const ctx = createTestContext();
    const res = await jsonRequest(ctx.app, '/api/does-not-exist');

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('not_found');
  });

  it('健康检查可用', async () => {
    const ctx = createTestContext();
    const res = await jsonRequest(ctx.app, '/api/health');
    expect(res.status).toBe(200);
  });

  it('阶段列表与阶段详情是公开的', async () => {
    const ctx = createTestContext();

    expect((await jsonRequest(ctx.app, '/api/stages')).status).toBe(200);
    expect((await jsonRequest(ctx.app, '/api/stages/rag')).status).toBe(200);
    expect((await jsonRequest(ctx.app, '/api/stages/nope')).status).toBe(404);

    const detail = (await (await jsonRequest(ctx.app, '/api/stages/rag')).json()) as {
      stage: { id: string };
      resources: unknown[];
      quizTotal: number;
    };
    expect(detail.stage.id).toBe('rag');
    expect(detail.resources).toHaveLength(3);
    expect(detail.quizTotal).toBeGreaterThan(0);
  });
});
