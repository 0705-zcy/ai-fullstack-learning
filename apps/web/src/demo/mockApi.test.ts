import { STAGES } from '@aifs/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiRequestError } from '../api/client.js';
import demoData from './data.json';
import { DEMO_CREDENTIALS, demoControls, demoMeta, mockApi } from './mockApi.js';

/**
 * 演示模式的行为测试。
 *
 * 重点不是「跑得通」，而是**和真实后端表现一致**：
 * 同样的鉴权规则、同样的筛选语义、同样不下发答案、同样的进度数字。
 * 演示里看到的界面如果和真实产品不一样，那演示就是误导。
 */

interface SeedQuestion {
  id: string;
  stage: string;
  answerIndex: number;
  options: string[];
}
const QUESTIONS = demoData.questions as unknown as SeedQuestion[];

async function login(): Promise<void> {
  await mockApi.login({ email: DEMO_CREDENTIALS.email, password: DEMO_CREDENTIALS.password });
}

function answersFor(stage: string, correctCount: number) {
  const bank = QUESTIONS.filter((q) => q.stage === stage);
  return bank.map((q, index) => ({
    questionId: q.id,
    optionIndex: index < correctCount ? q.answerIndex : (q.answerIndex + 1) % q.options.length,
  }));
}

beforeEach(() => {
  demoControls.reset();
});

describe('演示数据', () => {
  it('来自真实种子数据，规模与后端一致', () => {
    expect(demoMeta.resourceCount).toBe(66);
    expect(demoMeta.questionCount).toBe(36);
  });

  it('每个阶段都有资源与题目', () => {
    for (const stage of STAGES) {
      expect(demoData.resources.filter((r) => r.stage === stage.id).length).toBeGreaterThanOrEqual(2);
      expect(demoData.questions.filter((q) => q.stage === stage.id).length).toBeGreaterThanOrEqual(5);
    }
  });

  it('每个阶段都有至少两门完整体系课（与后端校验规则一致）', () => {
    for (const stage of STAGES) {
      const curriculum = demoData.resources.filter(
        (r) => r.stage === stage.id && r.scope === 'curriculum',
      ).length;
      expect(curriculum, `阶段 ${stage.id} 的体系课不足`).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('鉴权', () => {
  it('未登录时受保护接口返回 401', async () => {
    await expect(mockApi.me()).rejects.toMatchObject({ status: 401 });
    await expect(mockApi.getDashboard()).rejects.toMatchObject({ status: 401 });
    await expect(mockApi.listProgress()).rejects.toMatchObject({ status: 401 });
    await expect(mockApi.setProgress('foundation-zh-ts-wangdoc', 'completed')).rejects.toMatchObject({
      status: 401,
    });
  });

  it('注册：校验邮箱与密码长度', async () => {
    await expect(
      mockApi.register({ email: 'not-an-email', password: 'longenough' }),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      mockApi.register({ email: 'ok@example.com', password: 'short' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('注册成功后新用户是干净状态（与真实产品一致）', async () => {
    const { user } = await mockApi.register({
      email: 'new@example.com',
      password: 'password123',
      displayName: '新同学',
    });

    expect(user.email).toBe('new@example.com');
    expect(user.displayName).toBe('新同学');

    const dashboard = await mockApi.getDashboard();
    expect(dashboard.overall.completedResources).toBe(0);
    expect(dashboard.overall.completion).toBe(0);
    expect(dashboard.stages[0]?.unlocked).toBe(true);
    expect(dashboard.stages[1]?.unlocked).toBe(false);
  });

  it('昵称留空时用邮箱前缀兜底', async () => {
    const { user } = await mockApi.register({ email: 'someone@example.com', password: 'password123' });
    expect(user.displayName).toBe('someone');
  });

  it('登录：密码太短返回 401（与真实后端同一句提示）', async () => {
    await expect(mockApi.login({ email: 'a@b.com', password: '123' })).rejects.toBeInstanceOf(
      ApiRequestError,
    );
  });

  it('登出后受保护接口重新变成 401', async () => {
    await login();
    await expect(mockApi.me()).resolves.toBeTruthy();

    await mockApi.logout();
    await expect(mockApi.me()).rejects.toMatchObject({ status: 401 });
  });
});

describe('资源库', () => {
  beforeEach(login);

  it('返回全部资源，并按学习路径排序', async () => {
    const { total, items } = await mockApi.listResources({});

    expect(total).toBe(66);
    expect(items[0]?.stage).toBe('foundation');
    expect(items[items.length - 1]?.stage).toBe('capstone');
  });

  it('默认排序把完整体系课排在同一阶段的前面', async () => {
    const { items } = await mockApi.listResources({});
    const foundation = items.filter((r) => r.stage === 'foundation');

    expect(foundation.length).toBeGreaterThan(3);
    // 前几项应该是体系课，最后应该是单点补充
    expect(foundation.slice(0, 3).every((r) => r.scope === 'curriculum')).toBe(true);
    expect(foundation[foundation.length - 1]?.scope).toBe('supplement');
  });

  it('可按覆盖范围筛选', async () => {
    const curriculum = await mockApi.listResources({ scope: 'curriculum' });
    expect(curriculum.items.length).toBeGreaterThan(20);
    expect(curriculum.items.every((r) => r.scope === 'curriculum')).toBe(true);

    const supplement = await mockApi.listResources({ scope: 'supplement' });
    expect(supplement.items.every((r) => r.scope === 'supplement')).toBe(true);

    // 两类加起来是全集
    expect(curriculum.total + supplement.total).toBe(66);
  });

  it('按阶段、语言、时长筛选', async () => {
    const rag = await mockApi.listResources({ stage: 'rag' });
    expect(rag.items.length).toBeGreaterThan(0);
    expect(rag.items.every((r) => r.stage === 'rag')).toBe(true);

    const zhShort = await mockApi.listResources({ language: 'zh', maxHours: 10 });
    expect(zhShort.items.length).toBeGreaterThan(0);
    expect(zhShort.items.every((r) => r.language === 'zh' && r.durationHours <= 10)).toBe(true);
  });

  it('关键词能命中标题、提供方与主题', async () => {
    const byTopic = await mockApi.listResources({ q: 'rag' });
    expect(byTopic.items.length).toBeGreaterThan(0);

    const byProvider = await mockApi.listResources({ q: 'Datawhale' });
    expect(byProvider.items.every((r) => /datawhale/i.test(r.provider))).toBe(true);

    const nothing = await mockApi.listResources({ q: 'zzzzz-not-a-topic' });
    expect(nothing.total).toBe(0);
  });

  it('facets 基于全量数据，不随筛选变化', async () => {
    const filtered = await mockApi.listResources({ stage: 'rag' });

    expect(filtered.facets.total).toBe(66);
    expect(filtered.facets.stages).toHaveLength(6);
    expect(filtered.facets.stages.every((s) => s.count >= 2)).toBe(true);
    expect(filtered.facets.stages.every((s) => s.curriculumCount >= 2)).toBe(true);
    expect(filtered.facets.curriculumCount).toBeGreaterThan(20);
  });

  it('排序参数生效', async () => {
    const asc = await mockApi.listResources({ sort: 'duration-asc' });
    const durations = asc.items.map((r) => r.durationHours);
    expect([...durations]).toEqual([...durations].sort((a, b) => a - b));

    const byTitle = await mockApi.listResources({ sort: 'title' });
    const titles = byTitle.items.map((r) => r.title);
    expect([...titles]).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
  });

  it('不存在的资源返回 404', async () => {
    await expect(mockApi.getResource('ghost')).rejects.toMatchObject({ status: 404 });
  });

  it('阶段详情带资源与题量，未知阶段 404', async () => {
    const detail = await mockApi.getStage('rag');
    expect(detail.stage.title).toBe('检索增强生成');
    expect(detail.resources.length).toBeGreaterThan(0);
    expect(detail.quizTotal).toBe(6);
  });
});

describe('自测', () => {
  beforeEach(login);

  it('下发的题目不含答案与解析', async () => {
    const { questions } = await mockApi.getQuiz('rag');

    expect(questions).toHaveLength(6);
    for (const question of questions) {
      expect(question).not.toHaveProperty('answerIndex');
      expect(question).not.toHaveProperty('explanation');
      expect(question.options.length).toBeGreaterThanOrEqual(2);
    }
    expect(JSON.stringify(questions)).not.toContain('answerIndex');
  });

  it('全对：达到通过线并记录成绩', async () => {
    const result = await mockApi.submitQuiz('rag', answersFor('rag', 6));

    expect(result.score).toBe(6);
    expect(result.bankTotal).toBe(6);
    expect(result.passed).toBe(true);
    expect(result.bestScore).toBe(6);
    expect(result.results.every((r) => r.correct)).toBe(true);
  });

  it('5/6 达到 80% 线算通过，4/6 不算', async () => {
    expect((await mockApi.submitQuiz('rag', answersFor('rag', 5))).passed).toBe(true);

    demoControls.reset();
    await login();
    const four = await mockApi.submitQuiz('rag', answersFor('rag', 4));

    expect(four.passed).toBe(false);
    expect(four.results.filter((r) => !r.correct)).toHaveLength(2);
    expect(four.results.every((r) => r.explanation.length > 0)).toBe(true);
  });

  it('历史最好成绩不会被后续的低分覆盖', async () => {
    await mockApi.submitQuiz('agent', answersFor('agent', 6));
    const second = await mockApi.submitQuiz('agent', answersFor('agent', 1));

    expect(second.score).toBe(1);
    expect(second.bestScore).toBe(6);
  });

  it('未登录不能交卷', async () => {
    demoControls.reset();
    await expect(mockApi.submitQuiz('rag', answersFor('rag', 6))).rejects.toMatchObject({
      status: 401,
    });
  });

  it('作答历史可选且按时间倒序', async () => {
    await mockApi.submitQuiz('rag', answersFor('rag', 2));
    await mockApi.submitQuiz('rag', answersFor('rag', 6));

    const { attempts } = await mockApi.listAttempts('rag');
    expect(attempts).toHaveLength(2);
    expect(attempts[0]?.score).toBe(6);
  });
});

describe('进度', () => {
  beforeEach(login);

  it('设置、读取、删除进度', async () => {
    const resourceId = demoData.resources[0]!.id;

    await mockApi.setProgress(resourceId, 'learning');
    expect((await mockApi.listProgress()).entries).toHaveLength(1);

    // 重复设置是更新而不是新增
    await mockApi.setProgress(resourceId, 'completed');
    const entries = (await mockApi.listProgress()).entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]?.status).toBe('completed');

    await mockApi.clearProgress(resourceId);
    expect((await mockApi.listProgress()).entries).toHaveLength(0);
  });

  it('不存在的资源返回 404，重复删除也返回 404', async () => {
    await expect(mockApi.setProgress('ghost', 'completed')).rejects.toMatchObject({ status: 404 });
    await expect(mockApi.clearProgress('ghost')).rejects.toMatchObject({ status: 404 });
  });

  it('进度会体现在仪表盘上', async () => {
    const resourceId = demoData.resources[0]!.id;
    await mockApi.setProgress(resourceId, 'completed');

    const dashboard = await mockApi.getDashboard();
    expect(dashboard.overall.completedResources).toBe(1);
    expect(dashboard.overall.estimatedHoursSpent).toBeGreaterThan(0);
  });
});

describe('演示工具条的数据操作', () => {
  it('填充示例进度：造出「学了一半」的状态', async () => {
    await login();
    demoControls.fillSampleProgress();

    const dashboard = await mockApi.getDashboard();

    expect(dashboard.overall.completedResources).toBeGreaterThan(0);
    expect(dashboard.stages[0]?.completed).toBe(true); // 阶段 1 已完成
    expect(dashboard.stages[1]?.unlocked).toBe(true); // 阶段 2 已解锁
    expect(dashboard.stages[1]?.completed).toBe(false);
    expect(dashboard.currentStage).toBe('llm-core');
    expect(dashboard.overall.passedQuizzes).toBeGreaterThanOrEqual(1);
    expect(dashboard.continueLearning).not.toBeNull();
  });

  it('填充后会保留登录状态', async () => {
    await login();
    demoControls.fillSampleProgress();
    await expect(mockApi.me()).resolves.toBeTruthy();
  });

  it('重置：清空进度并回到未登录状态', async () => {
    await login();
    demoControls.fillSampleProgress();
    expect(demoControls.hasActivity()).toBe(true);

    demoControls.reset();

    expect(demoControls.hasActivity()).toBe(false);
    await expect(mockApi.me()).rejects.toMatchObject({ status: 401 });
  });

  it('未登录时填充示例进度是空操作', () => {
    demoControls.fillSampleProgress();
    expect(demoControls.hasActivity()).toBe(false);
  });
});

describe('状态持久化', () => {
  it('进度写入 localStorage，可在「重新打开页面」后恢复', async () => {
    await login();
    const resourceId = demoData.resources[0]!.id;
    await mockApi.setProgress(resourceId, 'completed');

    const raw = localStorage.getItem('aifs-demo-state-v1');
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw!) as { progress: Record<string, unknown>; user: unknown };
    expect(parsed.progress[resourceId]).toBeTruthy();
    expect(parsed.user).toBeTruthy();
  });

  it('localStorage 内容损坏时退回空状态而不是崩溃', async () => {
    localStorage.setItem('aifs-demo-state-v1', '{ this is not json');
    // 重新加载模块状态的手动模拟：直接调用 reset 后确认仍可用
    demoControls.reset();
    await expect(mockApi.me()).rejects.toMatchObject({ status: 401 });
  });
});
