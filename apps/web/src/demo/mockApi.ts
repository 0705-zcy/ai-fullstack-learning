import {
  STAGES,
  STAGE_BY_ID,
  buildDashboard,
  gradeQuiz,
  isQuizPassed,
  isStageId,
  type DashboardSummary,
  type Difficulty,
  type ProgressEntry,
  type ProgressStatus,
  type QuizAttempt,
  type QuizQuestion,
  type Resource,
  type Stage,
  type StageId,
  type User,
} from '@aifs/shared';
import {
  ApiRequestError,
  type ApiClient,
  type QuizQuestionPublic,
  type QuizSubmissionResult,
  type ResourceFacets,
  type ResourceQuery,
} from '../api/client.js';
import demoData from './data.json';

/**
 * 演示模式的「后端」：全部跑在浏览器内存里，不发起任何网络请求。
 *
 * 三个刻意的设计：
 *  1. **复用真实领域逻辑**——进度计算与判卷直接 import @aifs/shared，
 *     保证演示出来的百分比、解锁状态、通过线与真实产品一模一样。
 *  2. **复用真实课程数据**——resources/questions 由 `npm run demo:data`
 *     从后端种子数据导出，不是另写一份假数据。
 *  3. **状态持久化到 localStorage**——刷新页面不会丢失进度，
 *     否则没法完整走一遍「标记进度 → 做自测 → 看阶段解锁」的流程。
 */

const STORAGE_KEY = 'aifs-demo-state-v1';
/**
 * 模拟网络延迟，让加载态在演示里可见（不然骨架屏一闪而过）。
 * 测试环境下归零，否则每个请求 110ms 会让测试变得很慢。
 */
const LATENCY_MS = import.meta.env.MODE === 'test' ? 0 : 110;

interface DemoState {
  user: User | null;
  /** resourceId → 进度 */
  progress: Record<string, { status: ProgressStatus; updatedAt: string }>;
  attempts: QuizAttempt[];
}

interface DemoData {
  resourceCount: number;
  questionCount: number;
  resources: Resource[];
  questions: QuizQuestion[];
}

const DATA = demoData as unknown as DemoData;
const RESOURCES: readonly Resource[] = DATA.resources;
const QUESTIONS: readonly QuizQuestion[] = DATA.questions;

const EMPTY_STATE: DemoState = { user: null, progress: {}, attempts: [] };

let attemptCounter = 0;

function delay<T>(value: T, ms = LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function fail(status: number, code: string, message: string): never {
  throw new ApiRequestError(status, code, message);
}

// ---------- 状态读写 ----------

function load(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(EMPTY_STATE);

    const parsed = JSON.parse(raw) as Partial<DemoState>;
    return {
      user: parsed.user ?? null,
      progress: parsed.progress ?? {},
      attempts: parsed.attempts ?? [],
    };
  } catch {
    // localStorage 不可用（隐私模式）或数据损坏：退回空状态，不影响演示
    return structuredClone(EMPTY_STATE);
  }
}

let state: DemoState = load();

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存不下就只保留在内存里，演示仍可继续
  }
}

function requireUser(): User {
  if (!state.user) fail(401, 'unauthorized', '请先登录');
  return state.user;
}

function progressEntries(): ProgressEntry[] {
  return Object.entries(state.progress)
    .map(([resourceId, value]) => ({
      resourceId,
      status: value.status,
      updatedAt: value.updatedAt,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function progressMap(): Map<string, ProgressStatus> {
  return new Map(
    Object.entries(state.progress).map(([resourceId, value]) => [resourceId, value.status]),
  );
}

function questionsOf(stage: StageId): QuizQuestion[] {
  return QUESTIONS.filter((q) => q.stage === stage);
}

function bestScoreOf(stage: StageId): number {
  const scores = state.attempts.filter((a) => a.stage === stage).map((a) => a.score);
  return scores.length > 0 ? Math.max(...scores) : 0;
}

function quizTotals(): Map<StageId, number> {
  const map = new Map<StageId, number>();
  for (const question of QUESTIONS) {
    map.set(question.stage, (map.get(question.stage) ?? 0) + 1);
  }
  return map;
}

function bestScores(): Map<StageId, number> {
  const map = new Map<StageId, number>();
  for (const attempt of state.attempts) {
    map.set(attempt.stage, Math.max(map.get(attempt.stage) ?? 0, attempt.score));
  }
  return map;
}

function dashboard(): DashboardSummary {
  return buildDashboard(STAGES, {
    user: requireUser(),
    resources: [...RESOURCES],
    progressByResource: progressMap(),
    recentProgress: progressEntries(),
    quizTotals: quizTotals(),
    quizBestScores: bestScores(),
  });
}

// ---------- 资源筛选（与服务端 SQL 版本保持同样的语义）----------

const STAGE_ORDER = new Map(STAGES.map((stage) => [stage.id, stage.order]));
const DIFFICULTY_ORDER: Record<Difficulty, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

function matchesQuery(resource: Resource, query: ResourceQuery): boolean {
  if (query.stage && resource.stage !== query.stage) return false;
  if (query.language && resource.language !== query.language) return false;
  if (query.difficulty && resource.difficulty !== query.difficulty) return false;
  if (query.format && resource.format !== query.format) return false;
  if (typeof query.maxHours === 'number' && query.maxHours > 0) {
    if (resource.durationHours > query.maxHours) return false;
  }

  const keyword = query.q?.trim().toLowerCase();
  if (keyword) {
    const haystack = [
      resource.title,
      resource.provider,
      resource.description,
      resource.topics.join(' '),
    ]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(keyword)) return false;
  }

  return true;
}

function sortResources(items: Resource[], sort: ResourceQuery['sort']): Resource[] {
  const copy = [...items];

  switch (sort) {
    case 'duration-asc':
      return copy.sort((a, b) => a.durationHours - b.durationHours || a.title.localeCompare(b.title));
    case 'duration-desc':
      return copy.sort((a, b) => b.durationHours - a.durationHours || a.title.localeCompare(b.title));
    case 'title':
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    default:
      // 与服务端一致：阶段顺序 → 难度 → 时长
      return copy.sort(
        (a, b) =>
          (STAGE_ORDER.get(a.stage) ?? 99) - (STAGE_ORDER.get(b.stage) ?? 99) ||
          DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty] ||
          a.durationHours - b.durationHours,
      );
  }
}

function buildFacets(): ResourceFacets {
  const count = <T extends string>(pick: (r: Resource) => T) => {
    const map = new Map<T, number>();
    for (const resource of RESOURCES) {
      const key = pick(resource);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map].map(([value, n]) => ({ value, count: n }));
  };

  const topics = new Set<string>();
  for (const resource of RESOURCES) {
    for (const topic of resource.topics) topics.add(topic);
  }

  return {
    total: RESOURCES.length,
    stages: STAGES.map((stage) => ({
      id: stage.id,
      title: stage.title,
      count: RESOURCES.filter((r) => r.stage === stage.id).length,
    })),
    languages: count((r) => r.language),
    difficulties: count((r) => r.difficulty),
    formats: count((r) => r.format),
    topics: [...topics].sort((a, b) => a.localeCompare(b)),
  };
}

// ---------- 演示数据的批量填充 ----------

/** 造一份看起来"学了一半"的进度，用来快速预览有数据时的界面。 */
function sampleState(user: User): DemoState {
  const now = Date.now();
  const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();

  const progress: DemoState['progress'] = {};
  const stageResources = (stage: StageId) => RESOURCES.filter((r) => r.stage === stage);

  // 阶段 1：全部完成
  stageResources('foundation').forEach((resource, index) => {
    progress[resource.id] = { status: 'completed', updatedAt: at(600 - index * 30) };
  });

  // 阶段 2：差最后一个就完成（让阶段 3 处于解锁边缘）
  const llmCore = stageResources('llm-core');
  llmCore.forEach((resource, index) => {
    if (index === llmCore.length - 1) {
      progress[resource.id] = { status: 'learning', updatedAt: at(12) };
    } else {
      progress[resource.id] = { status: 'completed', updatedAt: at(400 - index * 20) };
    }
  });

  // 阶段 3：刚开了个头
  const rag = stageResources('rag');
  if (rag[0]) progress[rag[0].id] = { status: 'learning', updatedAt: at(45) };
  if (rag[1]) progress[rag[1].id] = { status: 'wishlist', updatedAt: at(200) };

  // 造两条自测记录：阶段 1 通过、阶段 2 满分
  const attempts: QuizAttempt[] = [
    {
      id: 'demo-attempt-1',
      stage: 'foundation',
      score: 5,
      total: questionsOf('foundation').length,
      createdAt: at(500),
    },
    {
      id: 'demo-attempt-2',
      stage: 'llm-core',
      score: questionsOf('llm-core').length,
      total: questionsOf('llm-core').length,
      createdAt: at(60),
    },
  ];

  return { user, progress, attempts };
}

// ---------- mock API ----------

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 实现必须与真实 API 完全同形。
 * 标注成 ApiClient 后，漏实现一个方法或参数对不上都会在 `npm run typecheck` 时报错——
 * 这是保证「演示模式和真实产品行为一致」的第一道防线。
 */
export const mockApi: ApiClient = {
  async register(input: { email: string; password: string; displayName?: string }) {
    const email = input.email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(email)) fail(400, 'bad_request', '请输入有效的邮箱地址');
    if (input.password.length < 8) fail(400, 'bad_request', '密码至少需要 8 位');
    if (state.user && state.user.email === email) {
      fail(409, 'conflict', '该邮箱已注册（演示模式：换个邮箱或直接登录）');
    }

    const user: User = {
      id: `demo-user-${Date.now()}`,
      email,
      displayName: input.displayName?.trim() || email.split('@')[0] || '演示用户',
      createdAt: new Date().toISOString(),
    };

    // 与真实产品保持一致：新注册用户看到的是干净的空状态。
    // 想看「学了一半」的界面，用演示横幅上的「填充示例进度」。
    state = { user, progress: {}, attempts: [] };
    persist();
    return delay({ user });
  },

  async login(input: { email: string; password: string }) {
    const email = input.email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(email)) fail(400, 'bad_request', '请输入有效的邮箱地址');
    if (input.password.length < 8) fail(401, 'unauthorized', '邮箱或密码不正确');

    // 已是同一个用户就保留现有进度，否则换一个新用户
    if (!state.user || state.user.email !== email) {
      const user: User = {
        id: `demo-user-${Date.now()}`,
        email,
        displayName: email.split('@')[0] || '演示用户',
        createdAt: new Date().toISOString(),
      };
      state = { ...state, user };
      persist();
    }

    return delay({ user: state.user as User });
  },

  async logout() {
    state = { ...state, user: null };
    persist();
    return delay({ ok: true as const });
  },

  async me() {
    return delay({ user: requireUser() });
  },

  async listStages() {
    return delay({ stages: [...STAGES] as Stage[] });
  },

  async getStage(stageId: StageId) {
    if (!isStageId(stageId)) fail(404, 'not_found', `未知的阶段：${stageId}`);

    return delay({
      stage: STAGE_BY_ID[stageId],
      resources: sortResources(
        RESOURCES.filter((r) => r.stage === stageId),
        'default',
      ),
      quizTotal: questionsOf(stageId).length,
    });
  },

  async listResources(query: ResourceQuery = {}) {
    const items = sortResources(
      RESOURCES.filter((resource) => matchesQuery(resource, query)),
      query.sort,
    );

    // facets 始终基于全量数据，与服务端一致：筛完不会让选项消失
    return delay({ items: [...items], total: items.length, facets: buildFacets() });
  },

  async getResource(resourceId: string) {
    const resource = RESOURCES.find((r) => r.id === resourceId);
    if (!resource) fail(404, 'not_found', '找不到这个资源');
    return delay({ resource });
  },

  async getQuiz(stageId: StageId) {
    if (!isStageId(stageId)) fail(404, 'not_found', `未知的阶段：${stageId}`);

    // 与真实后端一致：下发的题目不含答案与解析
    const questions: QuizQuestionPublic[] = questionsOf(stageId).map((question) => ({
      id: question.id,
      stage: question.stage,
      prompt: question.prompt,
      options: [...question.options],
      difficulty: question.difficulty,
    }));

    return delay({ stage: stageId, questions, quizTotal: questions.length });
  },

  async submitQuiz(
    stageId: StageId,
    answers: Array<{ questionId: string; optionIndex: number }>,
  ): Promise<QuizSubmissionResult> {
    requireUser();
    if (!isStageId(stageId)) fail(404, 'not_found', `未知的阶段：${stageId}`);

    const bank = questionsOf(stageId);
    if (bank.length === 0) fail(400, 'bad_request', '这个阶段还没有自测题');

    const summary = gradeQuiz(stageId, new Map(bank.map((q) => [q.id, q])), answers);

    attemptCounter += 1;
    state.attempts.push({
      id: `demo-attempt-${Date.now()}-${attemptCounter}`,
      stage: stageId,
      score: summary.score,
      total: bank.length,
      createdAt: new Date().toISOString(),
    });
    persist();

    return delay({
      ...summary,
      bankTotal: bank.length,
      passed: isQuizPassed(summary.score, bank.length),
      bestScore: bestScoreOf(stageId),
    });
  },

  async listAttempts(stageId: StageId) {
    requireUser();
    if (!isStageId(stageId)) fail(404, 'not_found', `未知的阶段：${stageId}`);

    return delay({
      attempts: state.attempts
        .filter((attempt) => attempt.stage === stageId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    });
  },

  async listProgress() {
    requireUser();
    return delay({ entries: progressEntries() });
  },

  async setProgress(resourceId: string, status: ProgressStatus) {
    requireUser();
    if (!RESOURCES.some((r) => r.id === resourceId)) {
      fail(404, 'not_found', '找不到这个资源，无法记录进度');
    }

    state.progress[resourceId] = { status, updatedAt: new Date().toISOString() };
    persist();

    return delay({ entry: { resourceId, status, updatedAt: state.progress[resourceId].updatedAt } });
  },

  async clearProgress(resourceId: string) {
    requireUser();
    if (!state.progress[resourceId]) fail(404, 'not_found', '这条进度记录不存在');

    delete state.progress[resourceId];
    persist();
    return delay({ ok: true as const });
  },

  async getDashboard() {
    return delay(dashboard());
  },
};

/** 演示模式独有的操作，真实 API 没有对应方法。 */
export const demoControls = {
  /** 清空全部演示数据，回到「新用户」状态。 */
  reset(): void {
    state = structuredClone(EMPTY_STATE);
    persist();
  },

  /** 一键填充「学了一半」的示例进度，便于预览有数据时的界面。 */
  fillSampleProgress(): void {
    if (!state.user) return;
    const preserved = state.user;
    state = sampleState(preserved);
    persist();
  },

  /** 当前是否有任何进度或自测记录。 */
  hasActivity(): boolean {
    return Object.keys(state.progress).length > 0 || state.attempts.length > 0;
  },
};

/** 演示数据集的元信息，展示在演示横幅上。 */
export const demoMeta = {
  resourceCount: DATA.resourceCount,
  questionCount: DATA.questionCount,
};

/** 演示模式下登录页预填的凭据，省掉手输。 */
export const DEMO_CREDENTIALS = {
  email: 'demo@aifs.dev',
  password: 'demo-password',
} as const;
