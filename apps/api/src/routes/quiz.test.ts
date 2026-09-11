import { QUIZ_QUESTIONS } from '../seed/quizzes.js';
import { describe, expect, it } from 'vitest';
import { createTestContext, jsonRequest, signUp } from '../test-support/context.js';

interface QuestionsBody {
  stage: string;
  quizTotal: number;
  questions: Array<Record<string, unknown>>;
}

interface SubmitBody {
  score: number;
  total: number;
  passed: boolean;
  bankTotal: number;
  bestScore: number;
  results: Array<{
    questionId: string;
    correct: boolean;
    submittedIndex: number | null;
    correctIndex: number;
    explanation: string;
  }>;
}

/** 从真实题库里取某阶段的正确/错误答案，避免测试硬编码下标。 */
function answersFor(stage: string, correctCount: number) {
  const bank = QUIZ_QUESTIONS.filter((q) => q.stage === stage);
  return bank.map((q, index) => ({
    questionId: q.id,
    // 前 correctCount 题故意给正确答案，其余给错误的
    optionIndex: index < correctCount ? q.answerIndex : (q.answerIndex + 1) % q.options.length,
  }));
}

describe('GET /api/quiz/:stage', () => {
  it('返回题目但绝不泄露答案与解析', async () => {
    const ctx = createTestContext();
    const res = await jsonRequest(ctx.app, '/api/quiz/rag');

    expect(res.status).toBe(200);
    const body = (await res.json()) as QuestionsBody;

    expect(body.stage).toBe('rag');
    expect(body.quizTotal).toBe(6);
    expect(body.questions).toHaveLength(6);

    for (const question of body.questions) {
      expect(question).not.toHaveProperty('answerIndex');
      expect(question).not.toHaveProperty('explanation');
      expect(question).toHaveProperty('prompt');
      expect(question).toHaveProperty('options');
    }

    // 双保险：序列化后的响应文本里不能出现答案字段名
    expect(JSON.stringify(body)).not.toContain('answerIndex');
  });

  it('未知阶段返回 404', async () => {
    const ctx = createTestContext();
    const res = await jsonRequest(ctx.app, '/api/quiz/nope');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/quiz/:stage/submit', () => {
  it('未登录返回 401', async () => {
    const ctx = createTestContext();
    const res = await jsonRequest(ctx.app, '/api/quiz/rag/submit', {
      method: 'POST',
      body: { stage: 'rag', answers: answersFor('rag', 6) },
    });

    expect(res.status).toBe(401);
  });

  it('全对：score 等于题库总数，passed 为 true', async () => {
    const ctx = createTestContext();
    const session = await signUp(ctx.app);

    const res = await jsonRequest(ctx.app, '/api/quiz/rag/submit', {
      method: 'POST',
      cookie: session.cookie,
      body: { stage: 'rag', answers: answersFor('rag', 6) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as SubmitBody;

    expect(body.score).toBe(6);
    expect(body.total).toBe(6);
    expect(body.bankTotal).toBe(6);
    expect(body.passed).toBe(true);
    expect(body.bestScore).toBe(6);
    expect(body.results.every((r) => r.correct)).toBe(true);
  });

  it('5/6 达到 80% 线算通过', async () => {
    const ctx = createTestContext();
    const session = await signUp(ctx.app);

    const res = await jsonRequest(ctx.app, '/api/quiz/rag/submit', {
      method: 'POST',
      cookie: session.cookie,
      body: { stage: 'rag', answers: answersFor('rag', 5) },
    });

    const body = (await res.json()) as SubmitBody;
    expect(body.score).toBe(5);
    expect(body.passed).toBe(true);
  });

  it('4/6 没过线，但仍返回逐题的正确答案与解析用于复习', async () => {
    const ctx = createTestContext();
    const session = await signUp(ctx.app);

    const res = await jsonRequest(ctx.app, '/api/quiz/rag/submit', {
      method: 'POST',
      cookie: session.cookie,
      body: { stage: 'rag', answers: answersFor('rag', 4) },
    });

    const body = (await res.json()) as SubmitBody;
    expect(body.passed).toBe(false);

    const wrong = body.results.filter((r) => !r.correct);
    expect(wrong).toHaveLength(2);
    for (const item of wrong) {
      expect(item.explanation.length).toBeGreaterThan(0);
      expect(item.correctIndex).toBeGreaterThanOrEqual(0);
    }
  });

  it('只交部分题目时，通过线仍按题库总数计算（防止少交几题蒙混过关）', async () => {
    const ctx = createTestContext();
    const session = await signUp(ctx.app);

    const res = await jsonRequest(ctx.app, '/api/quiz/rag/submit', {
      method: 'POST',
      cookie: session.cookie,
      body: { stage: 'rag', answers: answersFor('rag', 6).slice(0, 2) },
    });

    const body = (await res.json()) as SubmitBody;
    expect(body.score).toBe(2);
    expect(body.total).toBe(2);
    expect(body.bankTotal).toBe(6);
    expect(body.passed).toBe(false); // 2/6 远低于 80%
  });

  it('URL 与请求体中的 stage 不一致时返回 400', async () => {
    const ctx = createTestContext();
    const session = await signUp(ctx.app);

    const res = await jsonRequest(ctx.app, '/api/quiz/rag/submit', {
      method: 'POST',
      cookie: session.cookie,
      body: { stage: 'agent', answers: answersFor('agent', 6) },
    });

    expect(res.status).toBe(400);
  });

  it('bestScore 记录历史最好成绩而不是最后一次', async () => {
    const ctx = createTestContext();
    const session = await signUp(ctx.app);

    await jsonRequest(ctx.app, '/api/quiz/agent/submit', {
      method: 'POST',
      cookie: session.cookie,
      body: { stage: 'agent', answers: answersFor('agent', 6) },
    });

    const second = await jsonRequest(ctx.app, '/api/quiz/agent/submit', {
      method: 'POST',
      cookie: session.cookie,
      body: { stage: 'agent', answers: answersFor('agent', 1) },
    });

    const body = (await second.json()) as SubmitBody;
    expect(body.score).toBe(1);
    expect(body.bestScore).toBe(6);
  });

  it('答案属于别的阶段时不被计入，防止跨阶段刷分', async () => {
    const ctx = createTestContext();
    const session = await signUp(ctx.app);

    const res = await jsonRequest(ctx.app, '/api/quiz/rag/submit', {
      method: 'POST',
      cookie: session.cookie,
      body: { stage: 'rag', answers: answersFor('agent', 6) },
    });

    const body = (await res.json()) as SubmitBody;
    expect(body.total).toBe(0);
    expect(body.score).toBe(0);
    expect(body.passed).toBe(false);
  });

  it('空答案被 schema 拦下', async () => {
    const ctx = createTestContext();
    const session = await signUp(ctx.app);

    const res = await jsonRequest(ctx.app, '/api/quiz/rag/submit', {
      method: 'POST',
      cookie: session.cookie,
      body: { stage: 'rag', answers: [] },
    });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/quiz/:stage/attempts', () => {
  it('返回该阶段的作答历史，最新在前', async () => {
    const ctx = createTestContext();
    const session = await signUp(ctx.app);

    await jsonRequest(ctx.app, '/api/quiz/rag/submit', {
      method: 'POST',
      cookie: session.cookie,
      body: { stage: 'rag', answers: answersFor('rag', 2) },
    });
    await jsonRequest(ctx.app, '/api/quiz/rag/submit', {
      method: 'POST',
      cookie: session.cookie,
      body: { stage: 'rag', answers: answersFor('rag', 6) },
    });

    const res = await jsonRequest(ctx.app, '/api/quiz/rag/attempts', { cookie: session.cookie });
    const body = (await res.json()) as { attempts: Array<{ score: number; stage: string }> };

    expect(body.attempts).toHaveLength(2);
    expect(body.attempts.every((a) => a.stage === 'rag')).toBe(true);
    expect(body.attempts[0]?.score).toBe(6);
  });

  it('未登录返回 401', async () => {
    const ctx = createTestContext();
    const res = await jsonRequest(ctx.app, '/api/quiz/rag/attempts');
    expect(res.status).toBe(401);
  });
});

describe('题库种子数据', () => {
  it('每个阶段都有题目下发', async () => {
    const ctx = createTestContext();
    for (const stage of ['foundation', 'llm-core', 'rag', 'agent', 'engineering', 'capstone']) {
      const res = await jsonRequest(ctx.app, `/api/quiz/${stage}`);
      const body = (await res.json()) as QuestionsBody;
      expect(body.questions.length).toBeGreaterThanOrEqual(5);
    }
  });
});
