import { describe, expect, it } from 'vitest';
import {
  QUIZ_PASS_RATIO,
  STAGES,
  STAGE_BY_ID,
  STAGE_IDS,
  isStageId,
} from './stages.js';
import { STAGE_ID_VALUES, registerSchema, submitQuizSchema } from './schemas.js';

describe('阶段定义', () => {
  it('恰好有 6 个阶段，且顺序为 1..6 无重复', () => {
    expect(STAGES).toHaveLength(6);
    expect(STAGES.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('每个阶段 id 唯一', () => {
    expect(new Set(STAGE_IDS).size).toBe(STAGES.length);
  });

  it('STAGE_ID_VALUES（schema 用的字面量）与 STAGES 完全一致', () => {
    // 防止两处定义漂移：schemas.ts 的字面量必须镜像 stages.ts 的真相
    expect([...STAGE_ID_VALUES]).toEqual([...STAGE_IDS]);
  });

  it('STAGE_BY_ID 能取到每个阶段，且与 STAGES 内部顺序无关', () => {
    for (const stage of STAGES) {
      expect(STAGE_BY_ID[stage.id]).toBe(stage);
    }
  });

  it('每个阶段都有非空的标题、摘要与学习成果', () => {
    for (const stage of STAGES) {
      expect(stage.title.length).toBeGreaterThan(0);
      expect(stage.subtitle.length).toBeGreaterThan(0);
      expect(stage.summary.length).toBeGreaterThan(10);
      expect(stage.outcomes.length).toBeGreaterThanOrEqual(3);
      expect(stage.estimatedWeeks).toBeGreaterThan(0);
    }
  });

  it('isStageId 只认合法阶段', () => {
    expect(isStageId('rag')).toBe(true);
    expect(isStageId('rag ')).toBe(false);
    expect(isStageId('')).toBe(false);
    expect(isStageId('unknown')).toBe(false);
    expect(isStageId(42)).toBe(false);
    expect(isStageId(null)).toBe(false);
  });

  it('通过线是合理比例', () => {
    expect(QUIZ_PASS_RATIO).toBeGreaterThan(0.5);
    expect(QUIZ_PASS_RATIO).toBeLessThanOrEqual(1);
  });
});

describe('注册校验', () => {
  it('规范化邮箱大小写与空白', () => {
    const result = registerSchema.parse({ email: '  Dev@Example.COM ', password: 'longenough' });
    expect(result.email).toBe('dev@example.com');
  });

  it('拒绝短密码与非法邮箱', () => {
    expect(registerSchema.safeParse({ email: 'a@b.com', password: 'short' }).success).toBe(false);
    expect(registerSchema.safeParse({ email: 'not-an-email', password: 'longenough' }).success).toBe(
      false,
    );
  });
});

describe('测验提交校验', () => {
  it('接受合法提交', () => {
    const parsed = submitQuizSchema.safeParse({
      stage: 'llm-core',
      answers: [{ questionId: 'q1', optionIndex: 2 }],
    });
    expect(parsed.success).toBe(true);
  });

  it('拒绝未知阶段与空答案', () => {
    expect(
      submitQuizSchema.safeParse({ stage: 'nope', answers: [{ questionId: 'q1', optionIndex: 0 }] })
        .success,
    ).toBe(false);
    expect(submitQuizSchema.safeParse({ stage: 'rag', answers: [] }).success).toBe(false);
  });

  it('拒绝越界的选项下标', () => {
    expect(
      submitQuizSchema.safeParse({
        stage: 'rag',
        answers: [{ questionId: 'q1', optionIndex: -1 }],
      }).success,
    ).toBe(false);
    expect(
      submitQuizSchema.safeParse({
        stage: 'rag',
        answers: [{ questionId: 'q1', optionIndex: 3.5 }],
      }).success,
    ).toBe(false);
  });
});
