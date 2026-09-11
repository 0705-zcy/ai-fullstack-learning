import { STAGES, type ProgressStatus, type Resource, type StageId } from '@aifs/shared';
import { describe, expect, it } from 'vitest';
import { createFixtureResources, makeResource } from '../test-support/context.js';
import {
  UNLOCK_COMPLETION_THRESHOLD,
  buildDashboard,
  buildStageProgress,
  pickContinueLearning,
} from './progress.js';

const RESOURCES = createFixtureResources();

function progressMap(entries: Record<string, ProgressStatus>): Map<string, ProgressStatus> {
  return new Map(Object.entries(entries));
}

function build(input: {
  progress?: Record<string, ProgressStatus>;
  quizTotals?: Record<string, number>;
  quizBest?: Record<string, number>;
  resources?: Resource[];
}) {
  return buildStageProgress(STAGES, {
    resources: input.resources ?? RESOURCES,
    progressByResource: progressMap(input.progress ?? {}),
    quizTotals: new Map(Object.entries(input.quizTotals ?? {}) as Array<[StageId, number]>),
    quizBestScores: new Map(Object.entries(input.quizBest ?? {}) as Array<[StageId, number]>),
  });
}

function stage(result: ReturnType<typeof build>, id: StageId) {
  const found = result.find((s) => s.stage.id === id);
  if (!found) throw new Error(`结果里没有阶段 ${id}`);
  return found;
}

describe('buildStageProgress', () => {
  it('没有任何进度时：只有第一个阶段解锁，且完成度为 0', () => {
    const result = build({});

    expect(result).toHaveLength(6);
    expect(stage(result, 'foundation').unlocked).toBe(true);
    expect(stage(result, 'foundation').completion).toBe(0);
    expect(stage(result, 'foundation').completed).toBe(false);

    for (const s of result.slice(1)) {
      expect(s.unlocked).toBe(false);
    }
  });

  it('按 order 排序输出，不受传入顺序影响', () => {
    const shuffled = [...STAGES].reverse();
    const result = buildStageProgress(shuffled, {
      resources: RESOURCES,
      progressByResource: new Map(),
      quizTotals: new Map(),
      quizBestScores: new Map(),
    });
    expect(result.map((s) => s.stage.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('资源全部完成 + 自测过线 → 阶段完成，并解锁下一阶段', () => {
    const result = build({
      progress: { 'foundation-a': 'completed', 'foundation-b': 'completed' },
      quizTotals: { foundation: 6 },
      quizBest: { foundation: 5 }, // 5/6 ≈ 83%，过 80% 线
    });

    const foundation = stage(result, 'foundation');
    expect(foundation.completed).toBe(true);
    expect(foundation.quizPassed).toBe(true);
    expect(foundation.completion).toBe(1);
    expect(stage(result, 'llm-core').unlocked).toBe(true);
    expect(stage(result, 'rag').unlocked).toBe(false);
  });

  it('资源全完成但自测没到 80% → 阶段不算完成，进度条也不会显示 100%', () => {
    const result = build({
      progress: { 'foundation-a': 'completed', 'foundation-b': 'completed' },
      quizTotals: { foundation: 6 },
      quizBest: { foundation: 4 }, // 4/6 ≈ 67%，没过线
    });

    const foundation = stage(result, 'foundation');
    expect(foundation.completed).toBe(false);
    expect(foundation.quizPassed).toBe(false);
    // 未完成时进度封顶 99%，避免「显示 100% 却没过」的困惑
    expect(foundation.completion).toBeLessThan(1);
    expect(foundation.completion).toBeGreaterThan(0.8);
  });

  it('自测过了但资源没做完 → 阶段不算完成', () => {
    const result = build({
      progress: { 'foundation-a': 'completed' },
      quizTotals: { foundation: 6 },
      quizBest: { foundation: 6 },
    });

    const foundation = stage(result, 'foundation');
    expect(foundation.quizPassed).toBe(true);
    expect(foundation.completed).toBe(false);
    expect(foundation.completedResources).toBe(1);
    expect(foundation.totalResources).toBe(2);
  });

  it('前一阶段完成度达到阈值即可解锁下一阶段（允许提前窥探）', () => {
    const result = build({
      progress: { 'foundation-a': 'completed', 'foundation-b': 'completed' },
      quizTotals: { foundation: 6 },
      quizBest: { foundation: 4 }, // 完成度 ≈ 0.92
    });

    const foundation = stage(result, 'foundation');
    expect(foundation.completed).toBe(false);
    expect(foundation.completion).toBeGreaterThanOrEqual(UNLOCK_COMPLETION_THRESHOLD);
    expect(stage(result, 'llm-core').unlocked).toBe(true);
  });

  it('正确区分三种状态的资源计数', () => {
    const result = build({
      progress: { 'foundation-a': 'completed', 'foundation-b': 'learning' },
      quizTotals: { foundation: 6 },
      quizBest: {},
    });

    const foundation = stage(result, 'foundation');
    expect(foundation.completedResources).toBe(1);
    expect(foundation.learningResources).toBe(1);
    expect(foundation.wishlistResources).toBe(0);
  });

  it('没有题目的阶段不会因为自测而卡住（quizPassed 视为通过）', () => {
    const result = build({
      progress: { 'foundation-a': 'completed', 'foundation-b': 'completed' },
      quizTotals: {}, // 完全没题
      quizBest: {},
    });

    const foundation = stage(result, 'foundation');
    expect(foundation.quizTotal).toBe(0);
    expect(foundation.quizPassed).toBe(true);
    expect(foundation.completed).toBe(true);
  });

  it('没有题目的阶段：完成度完全由资源决定，不能凭空多出分数', () => {
    const empty = stage(build({ quizTotals: {}, quizBest: {} }), 'foundation');
    expect(empty.completion).toBe(0); // 不是 25%

    const half = stage(
      build({
        progress: { 'foundation-a': 'completed' },
        quizTotals: {},
        quizBest: {},
      }),
      'foundation',
    );
    expect(half.completion).toBe(0.5); // 1/2 个资源，没有自测权重
  });

  it('阶段内没有任何资源时不会除零，也不会自动算完成', () => {
    const onlyFoundationA = [makeResource({ id: 'foundation-a', stage: 'foundation' })];
    const result = build({
      resources: onlyFoundationA,
      progress: { 'foundation-a': 'completed' },
      quizTotals: { foundation: 6 },
      quizBest: { foundation: 6 },
    });

    const rag = stage(result, 'rag');
    expect(rag.totalResources).toBe(0);
    expect(rag.completed).toBe(true); // 空阶段不阻塞
    expect(Number.isNaN(rag.completion)).toBe(false);
  });
});

describe('buildDashboard', () => {
  const user = {
    id: 'u1',
    email: 'learner@example.com',
    displayName: '学习者',
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  it('汇总资源数、完成度与累计投入小时数', () => {
    const summary = buildDashboard(STAGES, {
      user,
      resources: RESOURCES, // 每阶段 2h + 8h
      progressByResource: progressMap({
        'foundation-a': 'completed', // 2h
        'foundation-b': 'learning', // 不算投入
      }),
      recentProgress: [
        { resourceId: 'foundation-b', status: 'learning', updatedAt: '2024-05-01T10:00:00.000Z' },
      ],
      quizTotals: new Map([['foundation', 6]]),
      quizBestScores: new Map(),
    });

    expect(summary.user).toEqual(user);
    expect(summary.overall.totalResources).toBe(12);
    expect(summary.overall.completedResources).toBe(1);
    expect(summary.overall.learningResources).toBe(1);
    expect(summary.overall.estimatedHoursSpent).toBe(2);
    expect(summary.overall.completion).toBeCloseTo(1 / 12, 5);
    expect(summary.overall.completedStages).toBe(0);
    expect(summary.overall.passedQuizzes).toBe(0);
  });

  it('当前阶段是第一个「已解锁且未完成」的阶段', () => {
    const summary = buildDashboard(STAGES, {
      user,
      resources: RESOURCES,
      progressByResource: progressMap({
        'foundation-a': 'completed',
        'foundation-b': 'completed',
      }),
      recentProgress: [],
      quizTotals: new Map([['foundation', 6]]),
      quizBestScores: new Map([['foundation', 5]]),
    });

    expect(summary.stages[0]?.completed).toBe(true);
    expect(summary.currentStage).toBe('llm-core');
    expect(summary.overall.completedStages).toBe(1);
    expect(summary.overall.passedQuizzes).toBe(1);
  });

  it('全部完成后 currentStage 为 null', () => {
    const allDone: Record<string, ProgressStatus> = {};
    for (const resource of RESOURCES) allDone[resource.id] = 'completed';

    const quizTotals = new Map(STAGES.map((s) => [s.id, 6] as const));
    const quizBestScores = new Map(STAGES.map((s) => [s.id, 6] as const));

    const summary = buildDashboard(STAGES, {
      user,
      resources: RESOURCES,
      progressByResource: progressMap(allDone),
      recentProgress: [],
      quizTotals,
      quizBestScores,
    });

    expect(summary.currentStage).toBeNull();
    expect(summary.overall.completedStages).toBe(6);
    expect(summary.overall.completion).toBe(1);
    expect(summary.continueLearning).toBeNull();
  });
});

describe('pickContinueLearning', () => {
  const base = {
    resources: RESOURCES,
    progressByResource: new Map<string, ProgressStatus>(),
    recentProgress: [],
    currentStage: 'foundation' as StageId | null,
  };

  it('优先推荐最近标记为「在学」的资源', () => {
    const picked = pickContinueLearning({
      ...base,
      progressByResource: progressMap({ 'foundation-b': 'learning' }),
      recentProgress: [
        { resourceId: 'foundation-b', status: 'learning', updatedAt: '2024-05-01T10:00:00.000Z' },
      ],
    });

    expect(picked?.id).toBe('foundation-b');
  });

  it('有多条在学记录时取最近更新的一条', () => {
    const picked = pickContinueLearning({
      ...base,
      progressByResource: progressMap({ 'foundation-a': 'learning', 'foundation-b': 'learning' }),
      recentProgress: [
        { resourceId: 'foundation-a', status: 'learning', updatedAt: '2024-05-01T09:00:00.000Z' },
        { resourceId: 'foundation-b', status: 'learning', updatedAt: '2024-05-02T09:00:00.000Z' },
      ],
    });

    expect(picked?.id).toBe('foundation-b');
  });

  it('没有在学记录时，推荐当前阶段里最短的未完成资源（降低启动成本）', () => {
    const picked = pickContinueLearning(base);
    expect(picked?.id).toBe('foundation-a'); // 2h < 8h
  });

  it('当前阶段的资源都完成了就换下一个阶段', () => {
    const picked = pickContinueLearning({
      ...base,
      currentStage: 'llm-core',
      progressByResource: progressMap({ 'llm-core-a': 'completed' }),
    });

    expect(picked?.id).toBe('llm-core-b');
  });

  it('没有可用资源时返回 null', () => {
    const picked = pickContinueLearning({
      ...base,
      resources: [],
      currentStage: 'foundation',
    });
    expect(picked).toBeNull();
  });
});
