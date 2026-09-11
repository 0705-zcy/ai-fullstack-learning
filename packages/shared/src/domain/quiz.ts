import { QUIZ_PASS_RATIO } from '../stages.js';
import type { QuizQuestion, StageId } from '../types.js';

/**
 * 判卷逻辑。**纯函数**，不碰数据库。
 *
 * 和后端共用同一份实现：前端演示模式必须用真实规则判分，
 * 否则演示出来的分数和通过线就是假的。
 */

/** 单题判卷结果。 */
export interface GradedAnswer {
  questionId: string;
  /** 用户提交的下标；没提交则为 null。 */
  submittedIndex: number | null;
  /** 正确答案下标。 */
  correctIndex: number;
  correct: boolean;
  explanation: string;
}

/** 整卷判卷结果。 */
export interface GradeSummary {
  stage: StageId;
  score: number;
  total: number;
  passed: boolean;
  ratio: number;
  results: GradedAnswer[];
}

export interface SubmittedAnswer {
  questionId: string;
  optionIndex: number;
}

/**
 * 判卷。
 *
 * 规则：
 *  - 只统计属于该阶段的题目；跨阶段的题目 id 直接忽略（防止刷分）
 *  - 同一题重复提交时以最后一次为准
 *  - total = 有效作答的题数（而不是题库总数），
 *    但「是否通过」的分数线由调用方用题库总数来判断，避免少交几题就蒙混过关
 */
export function gradeQuiz(
  stage: StageId,
  questions: ReadonlyMap<string, QuizQuestion>,
  answers: readonly SubmittedAnswer[],
): GradeSummary {
  const lastByQuestion = new Map<string, number>();
  for (const answer of answers) {
    lastByQuestion.set(answer.questionId, answer.optionIndex);
  }

  const results: GradedAnswer[] = [];
  for (const [questionId, optionIndex] of lastByQuestion) {
    const question = questions.get(questionId);
    if (!question || question.stage !== stage) continue;

    results.push({
      questionId,
      submittedIndex: optionIndex,
      correctIndex: question.answerIndex,
      correct: optionIndex === question.answerIndex,
      explanation: question.explanation,
    });
  }

  // 稳定输出顺序：按传入题库的顺序排列，方便前端渲染
  const order = new Map<string, number>();
  let index = 0;
  for (const id of questions.keys()) {
    order.set(id, index);
    index += 1;
  }
  results.sort((a, b) => (order.get(a.questionId) ?? 0) - (order.get(b.questionId) ?? 0));

  const total = results.length;
  const score = results.filter((r) => r.correct).length;
  const ratio = total === 0 ? 0 : score / total;

  return {
    stage,
    score,
    total,
    ratio,
    // 单题都答对才叫通过；真正是否过线由上层结合题库总数判断
    passed: total > 0 && results.every((r) => r.correct),
    results,
  };
}

/** 结合题库总数判断是否达到通过线。 */
export function isQuizPassed(score: number, bankTotal: number): boolean {
  if (bankTotal <= 0) return false;
  return score / bankTotal >= QUIZ_PASS_RATIO;
}
