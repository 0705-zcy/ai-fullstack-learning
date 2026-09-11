import { z } from 'zod';
import type { StageId } from './types.js';

/**
 * 前后端共享的校验 schema。
 * 后端用它校验请求体，前端用它做表单校验，保证两边规则永远一致。
 */

/**
 * 阶段 id 的字面量元组。
 * 注意：必须与 stages.ts 中的 STAGES 保持一致，由 stages.test.ts 断言兜底。
 */
export const STAGE_ID_VALUES = [
  'foundation',
  'llm-core',
  'rag',
  'agent',
  'engineering',
  'capstone',
] as const satisfies readonly StageId[];

export const stageIdSchema = z.enum(STAGE_ID_VALUES);

export const difficultySchema = z.enum(['beginner', 'intermediate', 'advanced']);
export const resourceFormatSchema = z.enum(['video', 'docs', 'interactive', 'course']);
export const languageSchema = z.enum(['en', 'zh']);
export const progressStatusSchema = z.enum(['wishlist', 'learning', 'completed']);

/**
 * 邮箱校验：用正则而不是 z.string().email()，
 * 以避免 zod 主版本升级时 API 变更带来的破坏。
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, '邮箱地址过长')
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, '请输入有效的邮箱地址');

export const passwordSchema = z
  .string()
  .min(8, '密码至少需要 8 位')
  .max(128, '密码最多 128 位');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(40).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, '请输入密码').max(128),
});

export const setProgressSchema = z.object({
  resourceId: z.string().min(1).max(120),
  status: progressStatusSchema,
});

export const submitQuizSchema = z.object({
  stage: stageIdSchema,
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1).max(120),
        optionIndex: z.number().int().min(0).max(9),
      }),
    )
    .min(1, '至少提交一道题')
    .max(100, '一次最多提交 100 道题'),
});

/** 资源库筛选条件。 */
export const resourceQuerySchema = z.object({
  stage: stageIdSchema.optional(),
  language: languageSchema.optional(),
  difficulty: difficultySchema.optional(),
  format: resourceFormatSchema.optional(),
  q: z.string().trim().max(120).optional(),
  maxHours: z.coerce.number().positive().max(500).optional(),
  sort: z.enum(['default', 'duration-asc', 'duration-desc', 'title']).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SetProgressInput = z.infer<typeof setProgressSchema>;
export type SubmitQuizInput = z.infer<typeof submitQuizSchema>;
export type ResourceQueryInput = z.infer<typeof resourceQuerySchema>;
