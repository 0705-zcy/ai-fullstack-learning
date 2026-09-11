import type { QuizQuestion, Resource } from '@aifs/shared';
import { STAGE_IDS } from '@aifs/shared';
import { describe, expect, it } from 'vitest';
import { createFixtureResources, makeResource } from '../test-support/context.js';
import { QUIZ_QUESTIONS } from './quizzes.js';
import { RESOURCES } from './resources.js';
import {
  MIN_CURRICULUM_PER_STAGE,
  MIN_QUESTIONS_PER_STAGE,
  MIN_RESOURCES_PER_STAGE,
  assertSeedValid,
  validateQuestions,
  validateResources,
} from './validate.js';

function question(overrides: Partial<QuizQuestion> & { id: string }): QuizQuestion {
  return {
    stage: 'rag',
    prompt: '题干',
    options: ['A', 'B', 'C', 'D'],
    answerIndex: 0,
    explanation: '解析',
    difficulty: 'beginner',
    ...overrides,
  };
}

/** 造一批「每阶段都够数」的合法题目，用来单独验证某条规则。 */
function fullBank(override: (q: QuizQuestion) => QuizQuestion = (q) => q): QuizQuestion[] {
  const stages = ['foundation', 'llm-core', 'rag', 'agent', 'engineering', 'capstone'] as const;
  return stages.flatMap((stage) =>
    Array.from({ length: MIN_QUESTIONS_PER_STAGE }, (_, i) =>
      override(question({ id: `${stage}-q${i}`, stage })),
    ),
  );
}

describe('validateResources', () => {
  it('通过的 fixture 没有问题', () => {
    expect(validateResources(createFixtureResources())).toEqual([]);
  });

  it('揪出重复 id', () => {
    const resources = [
      ...createFixtureResources(),
      makeResource({ id: 'rag-a', stage: 'rag' }),
    ];
    expect(validateResources(resources).some((i) => i.includes('id 重复'))).toBe(true);
  });

  it('揪出非法 URL', () => {
    const resources = createFixtureResources().map((r) =>
      r.id === 'rag-a' ? { ...r, url: 'htp:/broken' } : r,
    );
    expect(validateResources(resources).some((i) => i.includes('url 不是合法'))).toBe(true);
  });

  it('揪出非法阶段', () => {
    const resources = createFixtureResources().map((r) =>
      r.id === 'rag-a' ? { ...r, stage: 'unknown' as Resource['stage'] } : r,
    );
    expect(validateResources(resources).some((i) => i.includes('阶段非法'))).toBe(true);
  });

  it('揪出非法的 scope', () => {
    const resources = createFixtureResources().map((r) =>
      r.id === 'rag-a' ? { ...r, scope: 'partial' as Resource['scope'] } : r,
    );
    expect(validateResources(resources).some((i) => i.includes('scope 非法'))).toBe(true);
  });

  it('某阶段的完整体系课不足两门时给出提示', () => {
    // 把 rag 阶段的一门体系课降级成单点补充，该阶段就只剩 1 门了
    const resources = createFixtureResources().map((r) =>
      r.id === 'rag-c' ? { ...r, scope: 'supplement' as const } : r,
    );

    const issues = validateResources(resources);
    expect(issues.some((i) => i.includes('rag') && i.includes('完整体系课'))).toBe(true);
  });

  it('揪出缺失说明与不合理时长', () => {
    const resources = createFixtureResources().map((r) => {
      if (r.id === 'rag-a') return { ...r, description: '  ' };
      if (r.id === 'rag-b') return { ...r, durationHours: 0 };
      return r;
    });
    const issues = validateResources(resources);

    expect(issues.some((i) => i.includes('缺少中文说明'))).toBe(true);
    expect(issues.some((i) => i.includes('durationHours 必须为正数'))).toBe(true);
  });

  it('某些阶段资源不够时给出提示', () => {
    const onlyFoundation = createFixtureResources().filter((r) => r.stage === 'foundation');
    const issues = validateResources(onlyFoundation);

    expect(issues.some((i) => i.includes('llm-core'))).toBe(true);
    expect(issues.some((i) => i.includes(`至少需要 ${MIN_RESOURCES_PER_STAGE} 个`))).toBe(true);
  });
});

describe('validateQuestions', () => {
  it('合法题库没有问题', () => {
    expect(validateQuestions(fullBank())).toEqual([]);
  });

  it('揪出越界的 answerIndex', () => {
    const bank = fullBank((q) => (q.id === 'rag-q0' ? { ...q, answerIndex: 9 } : q));
    expect(validateQuestions(bank).some((i) => i.includes('answerIndex 越界'))).toBe(true);
  });

  it('揪出负数 answerIndex', () => {
    const bank = fullBank((q) => (q.id === 'rag-q0' ? { ...q, answerIndex: -1 } : q));
    expect(validateQuestions(bank).some((i) => i.includes('answerIndex 越界'))).toBe(true);
  });

  it('揪出选项过少、选项重复与缺少解析', () => {
    const bank = fullBank((q) => {
      if (q.id === 'rag-q0') return { ...q, options: ['只有一个'] };
      if (q.id === 'rag-q1') return { ...q, options: ['A', 'A', 'B'] };
      if (q.id === 'rag-q2') return { ...q, explanation: '' };
      return q;
    });
    const issues = validateQuestions(bank);

    expect(issues.some((i) => i.includes('至少需要 2 个选项'))).toBe(true);
    expect(issues.some((i) => i.includes('存在重复选项'))).toBe(true);
    expect(issues.some((i) => i.includes('缺少解析'))).toBe(true);
  });

  it('某阶段题目不够时给出提示', () => {
    const bank = fullBank().filter((q) => q.stage !== 'capstone');
    expect(validateQuestions(bank).some((i) => i.includes('capstone'))).toBe(true);
  });
});

describe('assertSeedValid', () => {
  it('合法数据不抛错', () => {
    expect(() => assertSeedValid(createFixtureResources(), fullBank())).not.toThrow();
  });

  it('非法数据抛出带清单的错误', () => {
    expect(() => assertSeedValid(createFixtureResources(), [])).toThrowError(/种子数据校验失败/);
  });
});

describe('真实种子数据', () => {
  it('resources.ts 通过校验（每个阶段至少有 2 个可用资源）', () => {
    const issues = validateResources(RESOURCES);
    expect(issues, `资源数据有问题：\n${issues.join('\n')}`).toEqual([]);
  });

  it('quizzes.ts 通过校验（每个阶段至少有 5 道题）', () => {
    const issues = validateQuestions(QUIZ_QUESTIONS);
    expect(issues, `题库有问题：\n${issues.join('\n')}`).toEqual([]);
  });

  it('整批种子数据可以一次性通过', () => {
    expect(() => assertSeedValid(RESOURCES, QUIZ_QUESTIONS)).not.toThrow();
  });

  it('资源 id 全局唯一且不包含空格', () => {
    const ids = RESOURCES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z0-9-]+$/.test(id))).toBe(true);
  });

  it('资源链接全部是 https（避免混合内容与降级风险）', () => {
    const insecure = RESOURCES.filter((r) => !r.url.startsWith('https://'));
    expect(insecure.map((r) => `${r.id} → ${r.url}`)).toEqual([]);
  });

  it('资源和题目覆盖全部 6 个阶段', () => {
    for (const stage of STAGE_IDS) {
      expect(RESOURCES.filter((r) => r.stage === stage).length).toBeGreaterThanOrEqual(
        MIN_RESOURCES_PER_STAGE,
      );
      expect(QUIZ_QUESTIONS.filter((q) => q.stage === stage).length).toBeGreaterThanOrEqual(
        MIN_QUESTIONS_PER_STAGE,
      );
    }
  });

  it('每个阶段都有至少两门完整体系课（用户「能完整学会」的底线）', () => {
    for (const stage of STAGE_IDS) {
      const curriculum = RESOURCES.filter((r) => r.stage === stage && r.scope === 'curriculum');
      expect(
        curriculum.length,
        `阶段 ${stage} 只有 ${curriculum.length} 门体系课`,
      ).toBeGreaterThanOrEqual(MIN_CURRICULUM_PER_STAGE);
    }
  });

  it('体系课确实比单点补充长（否则分类标准就自相矛盾了）', () => {
    const avg = (items: readonly { durationHours: number }[]) =>
      items.reduce((sum, r) => sum + r.durationHours, 0) / (items.length || 1);

    const curriculumAvg = avg(RESOURCES.filter((r) => r.scope === 'curriculum'));
    const supplementAvg = avg(RESOURCES.filter((r) => r.scope === 'supplement'));

    expect(curriculumAvg).toBeGreaterThan(supplementAvg * 2);
  });
});
