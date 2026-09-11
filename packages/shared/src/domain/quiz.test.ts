import { describe, expect, it } from 'vitest';
import type { QuizQuestion } from '../types.js';
import { gradeQuiz, isQuizPassed } from './quiz.js';

function question(
  id: string,
  answerIndex: number,
  stage: QuizQuestion['stage'] = 'rag',
): QuizQuestion {
  return {
    id,
    stage,
    prompt: `题目 ${id}`,
    options: ['A', 'B', 'C', 'D'],
    answerIndex,
    explanation: `解析 ${id}`,
    difficulty: 'beginner',
  };
}

const BANK = new Map<string, QuizQuestion>([
  ['q1', question('q1', 1)],
  ['q2', question('q2', 2)],
  ['q3', question('q3', 0)],
  ['other', question('other', 0, 'agent')],
]);

describe('gradeQuiz', () => {
  it('全对时 score 等于题数，passed 为 true', () => {
    const result = gradeQuiz('rag', BANK, [
      { questionId: 'q1', optionIndex: 1 },
      { questionId: 'q2', optionIndex: 2 },
      { questionId: 'q3', optionIndex: 0 },
    ]);

    expect(result.score).toBe(3);
    expect(result.total).toBe(3);
    expect(result.ratio).toBe(1);
    expect(result.passed).toBe(true);
    expect(result.results.every((r) => r.correct)).toBe(true);
  });

  it('部分答错时记录正确答案与解析，便于前端展示', () => {
    const result = gradeQuiz('rag', BANK, [
      { questionId: 'q1', optionIndex: 3 },
      { questionId: 'q2', optionIndex: 2 },
    ]);

    expect(result.score).toBe(1);
    expect(result.total).toBe(2);
    expect(result.passed).toBe(false);

    const wrong = result.results.find((r) => r.questionId === 'q1');
    expect(wrong?.correct).toBe(false);
    expect(wrong?.submittedIndex).toBe(3);
    expect(wrong?.correctIndex).toBe(1);
    expect(wrong?.explanation).toBe('解析 q1');
  });

  it('忽略不属于该阶段的题目，防止跨阶段刷分', () => {
    const result = gradeQuiz('rag', BANK, [
      { questionId: 'other', optionIndex: 0 },
      { questionId: 'q1', optionIndex: 1 },
    ]);

    expect(result.total).toBe(1);
    expect(result.results.map((r) => r.questionId)).toEqual(['q1']);
  });

  it('忽略题库里不存在的题目 id', () => {
    const result = gradeQuiz('rag', BANK, [
      { questionId: 'ghost', optionIndex: 0 },
      { questionId: 'q2', optionIndex: 2 },
    ]);

    expect(result.total).toBe(1);
    expect(result.score).toBe(1);
  });

  it('同一题重复提交时以最后一次为准', () => {
    const result = gradeQuiz('rag', BANK, [
      { questionId: 'q1', optionIndex: 0 },
      { questionId: 'q1', optionIndex: 1 },
    ]);

    expect(result.total).toBe(1);
    expect(result.score).toBe(1);
    expect(result.results[0]?.submittedIndex).toBe(1);
  });

  it('结果顺序跟随题库顺序，而不是提交顺序', () => {
    const result = gradeQuiz('rag', BANK, [
      { questionId: 'q3', optionIndex: 0 },
      { questionId: 'q1', optionIndex: 1 },
    ]);

    expect(result.results.map((r) => r.questionId)).toEqual(['q1', 'q3']);
  });

  it('空提交不会崩，total 为 0 且不算通过', () => {
    const result = gradeQuiz('rag', BANK, []);
    expect(result.total).toBe(0);
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
  });
});

describe('isQuizPassed', () => {
  it('恰好达到 80% 算通过', () => {
    expect(isQuizPassed(4, 5)).toBe(true); // 0.8
    expect(isQuizPassed(5, 6)).toBe(true); // 0.833
    expect(isQuizPassed(8, 10)).toBe(true);
  });

  it('低于 80% 不算通过', () => {
    expect(isQuizPassed(3, 5)).toBe(false);
    expect(isQuizPassed(4, 6)).toBe(false);
    expect(isQuizPassed(0, 6)).toBe(false);
  });

  it('题库为空时永远不算通过（避免除零被当成满分）', () => {
    expect(isQuizPassed(0, 0)).toBe(false);
    expect(isQuizPassed(5, 0)).toBe(false);
  });
});
