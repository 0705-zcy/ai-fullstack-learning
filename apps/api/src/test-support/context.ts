import { STAGE_IDS, type Resource, type StageId } from '@aifs/shared';
import type { Hono } from 'hono';
import { createApp } from '../app.js';
import type { AppConfig } from '../config.js';
import { openDatabase, type Db } from '../db/index.js';
import type { AppEnv } from '../lib/auth.js';
import { upsertQuestion } from '../repositories/quiz.js';
import { upsertResource } from '../repositories/resources.js';
import { QUIZ_QUESTIONS } from '../seed/quizzes.js';

/**
 * 测试脚手架。
 *
 * 路由测试不应该依赖生产种子数据（内容会变，测试不能跟着碎），
 * 所以这里自己造 fixture；真实种子数据的完整性由 seed 目录下的测试单独保证。
 */

export function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 0,
    dbPath: ':memory:',
    jwtSecret: 'test-secret-do-not-use-anywhere-else',
    isProduction: false,
    webOrigin: 'http://localhost:5173',
    registrationMode: 'open',
    allowedEmails: [],
    ...overrides,
  };
}

export function makeResource(input: {
  id: string;
  stage: StageId;
  title?: string;
  durationHours?: number;
  language?: Resource['language'];
  difficulty?: Resource['difficulty'];
  format?: Resource['format'];
  scope?: Resource['scope'];
  topics?: string[];
}): Resource {
  return {
    id: input.id,
    title: input.title ?? `测试资源 ${input.id}`,
    url: `https://example.com/${input.id}`,
    provider: '测试提供方',
    language: input.language ?? 'en',
    difficulty: input.difficulty ?? 'beginner',
    format: input.format ?? 'docs',
    durationHours: input.durationHours ?? 4,
    topics: input.topics ?? ['testing'],
    stage: input.stage,
    scope: input.scope ?? 'supplement',
    description: `用于测试的 ${input.stage} 阶段资源`,
    notes: '测试数据',
    verified: true,
  };
}

/**
 * 每个阶段三个资源，覆盖到筛选与排序需要区分的所有维度：
 *  - `-a`：单点补充、2 小时、英文、入门 → 默认排序里排最后，用来验证「体系课优先」
 *  - `-b`：完整体系课、8 小时、中文、高阶
 *  - `-c`：完整体系课、12 小时、英文、进阶
 * 每阶段两门体系课，满足种子的最低要求，也让 scope 筛选两侧都有数据。
 */
export function createFixtureResources(): Resource[] {
  const resources: Resource[] = [];
  for (const stageId of STAGE_IDS) {
    resources.push(
      makeResource({ id: `${stageId}-a`, stage: stageId, durationHours: 2 }),
      makeResource({
        id: `${stageId}-b`,
        stage: stageId,
        durationHours: 8,
        difficulty: 'advanced',
        language: 'zh',
        scope: 'curriculum',
      }),
      makeResource({
        id: `${stageId}-c`,
        stage: stageId,
        durationHours: 12,
        difficulty: 'intermediate',
        scope: 'curriculum',
      }),
    );
  }
  return resources;
}

export interface TestContext {
  app: Hono<AppEnv>;
  db: Db;
  config: AppConfig;
}

export function createTestContext(
  options: { resources?: Resource[]; withQuiz?: boolean; config?: Partial<AppConfig> } = {},
): TestContext {
  const db = openDatabase(':memory:');
  const config = createTestConfig(options.config);

  for (const resource of options.resources ?? createFixtureResources()) {
    upsertResource(db, resource);
  }

  if (options.withQuiz !== false) {
    const positionByStage = new Map<string, number>();
    for (const question of QUIZ_QUESTIONS) {
      const position = positionByStage.get(question.stage) ?? 0;
      upsertQuestion(db, question, position);
      positionByStage.set(question.stage, position + 1);
    }
  }

  const app = createApp({ db, config, enableLogger: false });
  return { app, db, config };
}

const JSON_HEADERS = { 'content-type': 'application/json' } as const;

export interface TestSession {
  cookie: string;
  user: { id: string; email: string; displayName: string };
}

/** 注册一个用户并返回可用于后续请求的 cookie。 */
export async function signUp(
  app: Hono<AppEnv>,
  email = 'learner@example.com',
  password = 'password123',
  displayName?: string,
): Promise<TestSession> {
  const res = await app.request('/api/auth/register', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(displayName ? { email, password, displayName } : { email, password }),
  });

  if (res.status !== 201) {
    throw new Error(`注册失败（${res.status}）：${await res.text()}`);
  }

  const body = (await res.json()) as { user: TestSession['user'] };
  return { cookie: extractCookie(res), user: body.user };
}

/** 从响应里取出会话 cookie，拼成请求头可直接用的形式。 */
export function extractCookie(res: Response): string {
  const raw = res.headers.get('set-cookie') ?? '';
  const pair = raw.split(';')[0] ?? '';
  if (!pair.includes('=')) throw new Error(`响应里没有会话 cookie：${raw}`);
  return pair;
}

/** 带 cookie 的 JSON 请求头。 */
export function authHeaders(cookie: string): Record<string, string> {
  return { ...JSON_HEADERS, cookie };
}

/** 便捷方法：带 cookie 发 JSON 请求。 */
export async function jsonRequest(
  app: Hono<AppEnv>,
  path: string,
  init: { method?: string; body?: unknown; cookie?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = { ...JSON_HEADERS };
  if (init.cookie) headers.cookie = init.cookie;

  return await app.request(path, {
    method: init.method ?? 'GET',
    headers,
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}
