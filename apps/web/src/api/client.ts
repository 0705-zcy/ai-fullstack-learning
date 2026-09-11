import type {
  ApiError,
  AuthPolicy,
  DashboardSummary,
  Difficulty,
  LanguageCode,
  ProgressEntry,
  ProgressStatus,
  QuizAttempt,
  Resource,
  ResourceFormat,
  ResourceScope,
  Stage,
  StageId,
  User,
} from '@aifs/shared';

/** 后端返回的统一错误，前端可以直接读 message 展示给用户。 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }

  /** 是否是「没登录 / 登录过期」。 */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'include',
      ...init,
      headers: {
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...init.headers,
      },
    });
  } catch (cause) {
    throw new ApiRequestError(0, 'network_error', '无法连接服务器，请检查后端是否已启动', cause);
  }

  if (!response.ok) {
    let body: ApiError | null = null;
    try {
      body = (await response.json()) as ApiError;
    } catch {
      body = null;
    }

    throw new ApiRequestError(
      response.status,
      body?.error.code ?? 'unknown_error',
      body?.error.message ?? `请求失败（HTTP ${response.status}）`,
      body?.error.details,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface ResourceQuery {
  stage?: StageId | '';
  language?: LanguageCode | '';
  difficulty?: Difficulty | '';
  format?: ResourceFormat | '';
  scope?: ResourceScope | '';
  q?: string;
  maxHours?: number | '';
  sort?: 'default' | 'duration-asc' | 'duration-desc' | 'title';
}

export interface ResourceFacets {
  total: number;
  /** 全站的完整体系课数量，用于在筛选器上显示「能完整学会的有几门」。 */
  curriculumCount: number;
  stages: Array<{ id: StageId; title: string; count: number; curriculumCount: number }>;
  languages: Array<{ value: LanguageCode; count: number }>;
  difficulties: Array<{ value: Difficulty; count: number }>;
  formats: Array<{ value: ResourceFormat; count: number }>;
  scopes: Array<{ value: ResourceScope; count: number }>;
  topics: string[];
}

/** 把筛选条件转成查询串：空值一律不拼，避免后端收到 `?stage=` 这类噪音。 */
export function toQueryString(query: ResourceQuery): string {
  const params = new URLSearchParams();

  if (query.stage) params.set('stage', query.stage);
  if (query.language) params.set('language', query.language);
  if (query.difficulty) params.set('difficulty', query.difficulty);
  if (query.format) params.set('format', query.format);
  if (query.scope) params.set('scope', query.scope);
  if (query.q?.trim()) params.set('q', query.q.trim());
  if (typeof query.maxHours === 'number' && query.maxHours > 0) {
    params.set('maxHours', String(query.maxHours));
  }
  if (query.sort && query.sort !== 'default') params.set('sort', query.sort);

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export interface QuizQuestionPublic {
  id: string;
  stage: StageId;
  prompt: string;
  options: string[];
  difficulty: Difficulty;
}

export interface QuizSubmissionResult {
  stage: StageId;
  score: number;
  total: number;
  ratio: number;
  passed: boolean;
  bankTotal: number;
  bestScore: number;
  results: Array<{
    questionId: string;
    submittedIndex: number | null;
    correctIndex: number;
    correct: boolean;
    explanation: string;
  }>;
}

export const api = {
  // ---- 账号 ----
  /** 公开的认证策略：决定登录页要不要显示注册入口。 */
  async getAuthPolicy() {
    return request<AuthPolicy>('/auth/policy');
  },
  async register(input: { email: string; password: string; displayName?: string }) {
    return request<{ user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  async login(input: { email: string; password: string }) {
    return request<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  async logout() {
    return request<{ ok: true }>('/auth/logout', { method: 'POST' });
  },
  async me() {
    return request<{ user: User }>('/auth/me');
  },

  // ---- 学习路径 ----
  async listStages() {
    return request<{ stages: Stage[] }>('/stages');
  },
  async getStage(stageId: StageId) {
    return request<{ stage: Stage; resources: Resource[]; quizTotal: number }>(
      `/stages/${stageId}`,
    );
  },

  // ---- 资源库 ----
  async listResources(query: ResourceQuery = {}) {
    return request<{ items: Resource[]; total: number; facets: ResourceFacets }>(
      `/resources${toQueryString(query)}`,
    );
  },
  async getResource(resourceId: string) {
    return request<{ resource: Resource }>(`/resources/${encodeURIComponent(resourceId)}`);
  },

  // ---- 自测 ----
  async getQuiz(stageId: StageId) {
    return request<{ stage: StageId; questions: QuizQuestionPublic[]; quizTotal: number }>(
      `/quiz/${stageId}`,
    );
  },
  async submitQuiz(
    stageId: StageId,
    answers: Array<{ questionId: string; optionIndex: number }>,
  ) {
    return request<QuizSubmissionResult>(`/quiz/${stageId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ stage: stageId, answers }),
    });
  },
  async listAttempts(stageId: StageId) {
    return request<{ attempts: QuizAttempt[] }>(`/quiz/${stageId}/attempts`);
  },

  // ---- 进度 ----
  async listProgress() {
    return request<{ entries: ProgressEntry[] }>('/progress');
  },
  async setProgress(resourceId: string, status: ProgressStatus) {
    return request<{ entry: ProgressEntry }>('/progress', {
      method: 'PUT',
      body: JSON.stringify({ resourceId, status }),
    });
  },
  async clearProgress(resourceId: string) {
    return request<{ ok: true }>(`/progress/${encodeURIComponent(resourceId)}`, {
      method: 'DELETE',
    });
  },

  // ---- 仪表盘 ----
  async getDashboard() {
    return request<DashboardSummary>('/dashboard');
  },
};

/**
 * 真实 API 的完整类型。
 * 演示模式的 mock 实现会被标注成这个类型，因此任何签名不一致都会在编译期暴露。
 */
export type ApiClient = typeof api;
