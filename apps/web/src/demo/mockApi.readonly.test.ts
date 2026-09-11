import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 只读预览模式的测试。
 *
 * 难点在于 `DEMO_READONLY` 是模块加载时求值的常量，所以每个用例都要
 * `resetModules()` + 动态 import，让 mode.ts 用打桩后的 env 重新求值。
 * 这也顺带验证了「模式判断确实发生在模块加载期」这件事。
 */

async function loadReadonly() {
  vi.resetModules();
  vi.stubEnv('VITE_AIFS_DEMO', '1');
  vi.stubEnv('VITE_DEMO_READONLY', '1');
  return import('./mockApi.js');
}

async function loadInteractive() {
  vi.resetModules();
  vi.stubEnv('VITE_AIFS_DEMO', '1');
  vi.stubEnv('VITE_DEMO_READONLY', '0');
  return import('./mockApi.js');
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllEnvs();
});

describe('只读预览：模式判断', () => {
  it('打开了只读标志', async () => {
    const mode = await (async () => {
      vi.resetModules();
      vi.stubEnv('VITE_AIFS_DEMO', '1');
      vi.stubEnv('VITE_DEMO_READONLY', '1');
      return import('../api/mode.js');
    })();

    expect(mode.DEMO_MODE).toBe(true);
    expect(mode.DEMO_READONLY).toBe(true);
  });

  it('没开演示模式时，只读标志也不会打开（两者是包含关系）', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_AIFS_DEMO', '0');
    vi.stubEnv('VITE_DEMO_READONLY', '1');
    const mode = await import('../api/mode.js');

    expect(mode.DEMO_MODE).toBe(false);
    expect(mode.DEMO_READONLY).toBe(false);
  });
});

describe('只读预览：无需登录', () => {
  it('直接给出预览身份，不会 401', async () => {
    const { mockApi } = await loadReadonly();

    const { user } = await mockApi.me();
    expect(user.email).toBe('preview@aifs.dev');
    expect(user.displayName).toBe('预览访客');
  });

  it('仪表盘可直接访问，且是「学了一半」的预置状态', async () => {
    const { mockApi } = await loadReadonly();

    const dashboard = await mockApi.getDashboard();
    expect(dashboard.overall.completedResources).toBeGreaterThan(0);
    expect(dashboard.stages[0]?.completed).toBe(true);
    expect(dashboard.currentStage).toBe('llm-core');
  });

  it('退出登录是空操作，预览身份会立刻回来', async () => {
    const { mockApi } = await loadReadonly();

    await mockApi.logout();
    const { user } = await mockApi.me();
    expect(user.email).toBe('preview@aifs.dev');
  });
});

describe('只读预览：写操作全部拒绝', () => {
  it('注册被拒绝，并说明原因', async () => {
    const { mockApi } = await loadReadonly();

    await expect(
      mockApi.register({ email: 'new@example.com', password: 'password123' }),
    ).rejects.toMatchObject({ status: 403, code: 'read_only' });
  });

  it('标记进度被拒绝', async () => {
    const { mockApi } = await loadReadonly();
    const data = await mockApi.listResources({});
    const first = data.items[0]!;

    await expect(mockApi.setProgress(first.id, 'completed')).rejects.toMatchObject({
      status: 403,
      code: 'read_only',
    });
  });

  it('清除进度被拒绝', async () => {
    const { mockApi } = await loadReadonly();
    const entries = await mockApi.listProgress();
    const first = entries.entries[0]!;

    await expect(mockApi.clearProgress(first.resourceId)).rejects.toMatchObject({
      status: 403,
      code: 'read_only',
    });
  });

  it('提交自测被拒绝', async () => {
    const { mockApi } = await loadReadonly();
    const { questions } = await mockApi.getQuiz('rag');

    await expect(
      mockApi.submitQuiz(
        'rag',
        questions.map((q) => ({ questionId: q.id, optionIndex: 0 })),
      ),
    ).rejects.toMatchObject({ status: 403, code: 'read_only' });
  });

  it('拒绝信息里要说清「这是演示」而不是让人以为坏了', async () => {
    const { mockApi } = await loadReadonly();

    await expect(mockApi.register({ email: 'a@b.com', password: 'password123' })).rejects.toThrow(
      /只读预览/,
    );
  });
});

describe('只读预览：读操作全部正常', () => {
  it('资源库、筛选、阶段、自测题目都能看', async () => {
    const { mockApi } = await loadReadonly();

    const all = await mockApi.listResources({});
    expect(all.total).toBe(66);

    const curriculum = await mockApi.listResources({ scope: 'curriculum' });
    expect(curriculum.total).toBeGreaterThan(20);

    const stage = await mockApi.getStage('rag');
    expect(stage.resources.length).toBeGreaterThan(0);

    const quiz = await mockApi.getQuiz('rag');
    expect(quiz.questions).toHaveLength(6);
    // 依然不下发答案
    expect(JSON.stringify(quiz.questions)).not.toContain('answerIndex');

    const attempts = await mockApi.listAttempts('foundation');
    expect(attempts.attempts.length).toBeGreaterThan(0);
  });
});

describe('只读预览：状态不落盘', () => {
  it('不写 localStorage —— 每个访客看到的都是同一份预置数据', async () => {
    const { mockApi, demoControls } = await loadReadonly();

    // 即便调用写操作（会被拒绝），也不应该留下任何痕迹
    await mockApi.setProgress('whatever', 'completed').catch(() => undefined);
    demoControls.fillSampleProgress();
    demoControls.reset();

    expect(localStorage.getItem('aifs-demo-state-v1')).toBeNull();
  });

  it('reset 与 fillSampleProgress 是空操作，预览状态保持稳定', async () => {
    const { mockApi, demoControls } = await loadReadonly();

    const before = await mockApi.getDashboard();
    demoControls.reset();
    const after = await mockApi.getDashboard();

    expect(after.overall.completedResources).toBe(before.overall.completedResources);
    expect(after.overall.completedResources).toBeGreaterThan(0);
  });
});

describe('可交互演示不受影响', () => {
  it('没开只读标志时，写操作照常可用', async () => {
    const { mockApi } = await loadInteractive();

    // 未登录时是 401 而不是 403，说明走的是正常的鉴权路径
    await expect(mockApi.getDashboard()).rejects.toMatchObject({ status: 401 });

    await mockApi.login({ email: 'demo@aifs.dev', password: 'demo-password' });
    const data = await mockApi.listResources({});
    const first = data.items[0]!;

    await expect(mockApi.setProgress(first.id, 'completed')).resolves.toBeTruthy();
  });
});
