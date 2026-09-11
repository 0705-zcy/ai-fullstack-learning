import { QUIZ_PASS_RATIO, STAGES } from '../stages.js';
import type {
  DashboardSummary,
  ProgressStatus,
  Resource,
  Stage,
  StageId,
  StageProgress,
  User,
} from '../types.js';

/**
 * 学习进度计算。**纯函数**，不碰数据库、不碰网络。
 *
 * 放在 shared 而不是后端，是因为它需要有两个消费者：
 *  - 真实后端（apps/api）用它算用户仪表盘
 *  - 前端演示模式（apps/web）用同一套规则在浏览器里模拟
 * 两边共用同一份实现，演示出来的进度数字才和真实产品一致。
 *
 * 完成规则（刻意做得可解释）：
 *  - 阶段完成 = 该阶段资源全部标记 completed，且自测通过（正确率 >= 80%）
 *  - 阶段解锁 = 前一阶段已完成，或前一阶段完成度 >= 80%（允许提前窥探下一阶段）
 *  - 完成度不是简单的线性加权，而是「资源 75% + 自测 25%」，
 *    并且未完成时封顶 99%，避免进度条显示 100% 但阶段没完成带来的困惑。
 */

/** 前一阶段达到这个完成度即可解锁下一阶段。 */
export const UNLOCK_COMPLETION_THRESHOLD = 0.8;

export interface StageProgressInput {
  resources: readonly Resource[];
  /** resourceId → status */
  progressByResource: ReadonlyMap<string, ProgressStatus>;
  /** stage → 题目总数 */
  quizTotals: ReadonlyMap<StageId, number>;
  /** stage → 历史最好成绩（答对题数） */
  quizBestScores: ReadonlyMap<StageId, number>;
}

/** 按阶段聚合资源与进度，得到每个阶段的完成情况（含解锁链）。 */
export function buildStageProgress(
  stages: readonly Stage[],
  input: StageProgressInput,
): StageProgress[] {
  const resourcesByStage = new Map<StageId, Resource[]>();
  for (const resource of input.resources) {
    const list = resourcesByStage.get(resource.stage);
    if (list) list.push(resource);
    else resourcesByStage.set(resource.stage, [resource]);
  }

  const ordered = [...stages].sort((a, b) => a.order - b.order);
  const result: StageProgress[] = [];

  for (const stage of ordered) {
    const stageResources = resourcesByStage.get(stage.id) ?? [];

    let completedResources = 0;
    let learningResources = 0;
    let wishlistResources = 0;
    for (const resource of stageResources) {
      switch (input.progressByResource.get(resource.id)) {
        case 'completed':
          completedResources += 1;
          break;
        case 'learning':
          learningResources += 1;
          break;
        case 'wishlist':
          wishlistResources += 1;
          break;
        default:
          break;
      }
    }

    const totalResources = stageResources.length;
    const quizTotal = input.quizTotals.get(stage.id) ?? 0;
    const quizBestScore = input.quizBestScores.get(stage.id) ?? 0;
    const quizRatio = quizTotal > 0 ? Math.min(1, quizBestScore / quizTotal) : 0;
    const quizPassed = quizTotal === 0 ? true : quizBestScore / quizTotal >= QUIZ_PASS_RATIO;

    const resourceRatio = totalResources === 0 ? 1 : completedResources / totalResources;
    const completed = resourceRatio === 1 && quizPassed;

    // 没有自测题的阶段完全按资源算。否则会出现「一个资源都没开始，进度条却显示 25%」
    // 这种一眼假的现象——那 25% 是自测维度的"空满"，对用户毫无意义。
    const completion = completed
      ? 1
      : Math.min(0.99, quizTotal > 0 ? 0.75 * resourceRatio + 0.25 * quizRatio : resourceRatio);

    const previous = result[result.length - 1];
    const unlocked =
      previous === undefined ||
      previous.completed ||
      previous.completion >= UNLOCK_COMPLETION_THRESHOLD;

    result.push({
      stage,
      totalResources,
      completedResources,
      learningResources,
      wishlistResources,
      quizTotal,
      quizBestScore,
      quizPassed,
      unlocked,
      completed,
      completion,
    });
  }

  return result;
}

export interface DashboardInput extends StageProgressInput {
  user: User;
  /** 按更新时间倒序的进度记录，用于推荐「继续学习」。 */
  recentProgress: ReadonlyArray<{ resourceId: string; status: ProgressStatus; updatedAt: string }>;
}

/** 组装仪表盘数据。 */
export function buildDashboard(
  stages: readonly Stage[],
  input: DashboardInput,
): DashboardSummary {
  const stageProgress = buildStageProgress(stages, input);
  const byId = new Map(input.resources.map((r) => [r.id, r]));

  const totalResources = stageProgress.reduce((sum, s) => sum + s.totalResources, 0);
  const completedResources = stageProgress.reduce((sum, s) => sum + s.completedResources, 0);
  const learningResources = stageProgress.reduce((sum, s) => sum + s.learningResources, 0);

  const completedResourceIds = new Set<string>();
  for (const [resourceId, status] of input.progressByResource) {
    if (status === 'completed') completedResourceIds.add(resourceId);
  }
  const estimatedHoursSpent = [...completedResourceIds].reduce((sum, id) => {
    const resource = byId.get(id);
    return sum + (resource ? resource.durationHours : 0);
  }, 0);

  const currentStage = stageProgress.find((s) => s.unlocked && !s.completed)?.stage.id ?? null;

  return {
    user: input.user,
    stages: stageProgress,
    overall: {
      totalResources,
      completedResources,
      learningResources,
      completion: totalResources === 0 ? 0 : completedResources / totalResources,
      completedStages: stageProgress.filter((s) => s.completed).length,
      passedQuizzes: stageProgress.filter((s) => s.quizTotal > 0 && s.quizPassed).length,
      estimatedHoursSpent: Math.round(estimatedHoursSpent * 10) / 10,
    },
    currentStage,
    continueLearning: pickContinueLearning({
      resources: input.resources,
      progressByResource: input.progressByResource,
      recentProgress: input.recentProgress,
      currentStage,
    }),
  };
}

/**
 * 选一个「继续学习」的资源：
 *  1. 最近标记为 learning 的资源（用户显然正在看它）
 *  2. 否则：当前阶段里最短的、还没完成的资源（降低启动成本）
 *  3. 否则：null
 */
export function pickContinueLearning(input: {
  resources: readonly Resource[];
  progressByResource: ReadonlyMap<string, ProgressStatus>;
  recentProgress: ReadonlyArray<{ resourceId: string; status: ProgressStatus; updatedAt: string }>;
  currentStage: StageId | null;
}): Resource | null {
  const byId = new Map(input.resources.map((r) => [r.id, r]));

  const mostRecentLearning = [...input.recentProgress]
    .filter((entry) => entry.status === 'learning')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  if (mostRecentLearning) {
    const resource = byId.get(mostRecentLearning.resourceId);
    if (resource) return resource;
  }

  const candidates = input.resources.filter((resource) => {
    if (input.currentStage !== null && resource.stage !== input.currentStage) return false;
    return input.progressByResource.get(resource.id) !== 'completed';
  });

  const pool =
    candidates.length > 0
      ? candidates
      : input.resources.filter((r) => input.progressByResource.get(r.id) !== 'completed');

  if (pool.length === 0) return null;

  return (
    [...pool].sort((a, b) => a.durationHours - b.durationHours || a.title.localeCompare(b.title))[0] ??
    null
  );
}

/** 便捷入口：用默认的 6 阶段定义构建仪表盘。 */
export function buildDefaultDashboard(input: DashboardInput): DashboardSummary {
  return buildDashboard(STAGES, input);
}
