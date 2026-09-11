import { STAGE_IDS, isStageId, type QuizQuestion, type Resource } from '@aifs/shared';

/**
 * 种子数据校验。
 *
 * 资源是外部链接，题目是自产内容——两者都是手工维护的，
 * 所以必须有机器可查的规则兜底，否则一个错链接或错答案下标
 * 就会静默地毁掉学习体验。这些规则同时被单测引用。
 */

/** 每个阶段至少要有几个资源可选。 */
export const MIN_RESOURCES_PER_STAGE = 2;
/** 每个阶段至少要有几道自测题。 */
export const MIN_QUESTIONS_PER_STAGE = 5;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** 校验资源列表，返回人类可读的问题描述（空数组表示全部通过）。 */
export function validateResources(resources: readonly Resource[]): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();

  for (const resource of resources) {
    const where = `资源 ${resource.id || '(缺少 id)'}`;

    if (!resource.id) issues.push('存在缺少 id 的资源');
    if (seen.has(resource.id)) issues.push(`${where}：id 重复`);
    seen.add(resource.id);

    if (!resource.title.trim()) issues.push(`${where}：标题为空`);
    if (!isHttpUrl(resource.url)) issues.push(`${where}：url 不是合法的 http(s) 地址 → ${resource.url}`);
    if (!resource.provider.trim()) issues.push(`${where}：提供方为空`);
    if (!isStageId(resource.stage)) issues.push(`${where}：阶段非法 → ${resource.stage}`);
    if (!resource.description.trim()) issues.push(`${where}：缺少中文说明`);
    if (!Number.isFinite(resource.durationHours) || resource.durationHours <= 0) {
      issues.push(`${where}：durationHours 必须为正数`);
    }
    if (resource.durationHours > 500) {
      issues.push(`${where}：durationHours 看起来不合理（> 500）`);
    }
    if (!Array.isArray(resource.topics) || resource.topics.some((t) => !t.trim())) {
      issues.push(`${where}：topics 必须是字符串数组`);
    }
  }

  for (const stageId of STAGE_IDS) {
    const count = resources.filter((r) => r.stage === stageId).length;
    if (count < MIN_RESOURCES_PER_STAGE) {
      issues.push(`阶段 ${stageId} 只有 ${count} 个资源，至少需要 ${MIN_RESOURCES_PER_STAGE} 个`);
    }
  }

  return issues;
}

/** 校验题库，返回人类可读的问题描述（空数组表示全部通过）。 */
export function validateQuestions(questions: readonly QuizQuestion[]): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();

  for (const question of questions) {
    const where = `题目 ${question.id || '(缺少 id)'}`;

    if (!question.id) issues.push('存在缺少 id 的题目');
    if (seen.has(question.id)) issues.push(`${where}：id 重复`);
    seen.add(question.id);

    if (!isStageId(question.stage)) issues.push(`${where}：阶段非法 → ${question.stage}`);
    if (!question.prompt.trim()) issues.push(`${where}：题干为空`);
    if (!question.explanation.trim()) issues.push(`${where}：缺少解析`);

    if (!Array.isArray(question.options) || question.options.length < 2) {
      issues.push(`${where}：至少需要 2 个选项`);
    } else if (question.options.length > 6) {
      issues.push(`${where}：选项过多（${question.options.length} 个）`);
    } else if (question.options.some((option) => !option.trim())) {
      issues.push(`${where}：存在空选项`);
    } else if (!Number.isInteger(question.answerIndex) || question.answerIndex < 0 || question.answerIndex >= question.options.length) {
      issues.push(`${where}：answerIndex 越界 → ${question.answerIndex}`);
    }

    if (new Set(question.options).size !== question.options.length) {
      issues.push(`${where}：存在重复选项`);
    }
  }

  for (const stageId of STAGE_IDS) {
    const count = questions.filter((q) => q.stage === stageId).length;
    if (count < MIN_QUESTIONS_PER_STAGE) {
      issues.push(`阶段 ${stageId} 只有 ${count} 道题，至少需要 ${MIN_QUESTIONS_PER_STAGE} 道`);
    }
  }

  return issues;
}

/** 校验全部种子数据，有问题直接抛错（宁可启动失败，也不要带病上线）。 */
export function assertSeedValid(
  resources: readonly Resource[],
  questions: readonly QuizQuestion[],
): void {
  const issues = [...validateResources(resources), ...validateQuestions(questions)];
  if (issues.length > 0) {
    throw new Error(`种子数据校验失败（${issues.length} 项）：\n- ${issues.join('\n- ')}`);
  }
}
