/**
 * 平台领域模型。
 *
 * 设计原则：资源（Resource）是外部免费课程链接，平台不承载课程正文；
 * 平台自己产出的唯一内容是每个阶段的自测题（QuizQuestion）。
 */

/** 学习路径的 6 个阶段标识。 */
export type StageId =
  | 'foundation'
  | 'llm-core'
  | 'rag'
  | 'agent'
  | 'engineering'
  | 'capstone';

/** 资源难度。 */
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

/** 资源形式。 */
export type ResourceFormat = 'video' | 'docs' | 'interactive' | 'course';

/** 资源语言。 */
export type LanguageCode = 'en' | 'zh';

/**
 * 资源的「覆盖范围」——回答「学完这个我能不能真的学会」。
 *
 * - `curriculum`：**完整体系课**。从入门一路讲到能独立做出可运行的项目，
 *   有练习/作业/项目等动手环节，学完有可验证的产物。
 * - `supplement`：**单点补充**。官方文档、短课、专题文章，
 *   用来查漏补缺或深入某个具体问题，单独学完不足以掌握整个主题。
 *
 * 这个字段是产品的一等公民：用户最常见的诉求是「给我一条能走完的路」，
 * 而不是「给我一堆资料」。
 */
export type ResourceScope = 'curriculum' | 'supplement';

/** 用户对某个资源的学习状态。 */
export type ProgressStatus = 'wishlist' | 'learning' | 'completed';

/** 一条外部免费课程资源。 */
export interface Resource {
  id: string;
  title: string;
  url: string;
  provider: string;
  language: LanguageCode;
  difficulty: Difficulty;
  format: ResourceFormat;
  /** 预计学习小时数，用于排期建议。 */
  durationHours: number;
  topics: string[];
  stage: StageId;
  /** 覆盖范围：完整体系课 or 单点补充。 */
  scope: ResourceScope;
  /** 一句话中文说明：讲什么、适合谁。 */
  description: string;
  /** 免费范围 / 获取门槛说明。 */
  notes: string;
  /** 链接是否经过人工核实。 */
  verified: boolean;
}

/** 阶段元数据（静态定义，不存库）。 */
export interface Stage {
  id: StageId;
  /** 从 1 开始的顺序，决定解锁顺序。 */
  order: number;
  title: string;
  subtitle: string;
  summary: string;
  /** 学完这个阶段你应该能做到什么。 */
  outcomes: string[];
  /** 建议投入周数。 */
  estimatedWeeks: number;
  /** 用于前端的主题色（Tailwind 色名，如 "sky"）。 */
  accent: string;
}

/** 自测题选项。 */
export interface QuizQuestion {
  id: string;
  stage: StageId;
  prompt: string;
  options: string[];
  /** 正确选项在 options 中的下标。 */
  answerIndex: number;
  /** 答错时展示的解析。 */
  explanation: string;
  difficulty: Difficulty;
}

/** 用户公开信息（绝不含密码哈希）。 */
export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

/**
 * 这个实例的注册策略。
 *
 * - `open`：任何人都能注册（默认，方便 clone 下来直接试）
 * - `closed`：关闭注册，只有已存在的账号能登录（个人自用推荐）
 * - `whitelist`：只有名单里的邮箱能注册
 *
 * 注意：一个用户都没有时永远放行 —— 否则配上 closed 就谁也进不来了。
 */
export type RegistrationMode = 'open' | 'closed' | 'whitelist';

/** 后端下发的认证策略，前端据此决定要不要显示注册入口。 */
export interface AuthPolicy {
  mode: RegistrationMode;
  /** 是否还能创建新账号（closed 时为 false）。 */
  registrationEnabled: boolean;
}

/** 单条进度记录。 */
export interface ProgressEntry {
  resourceId: string;
  status: ProgressStatus;
  updatedAt: string;
}

/** 一次测验作答记录。 */
export interface QuizAttempt {
  id: string;
  stage: StageId;
  /** 答对题数。 */
  score: number;
  /** 本次题目总数。 */
  total: number;
  createdAt: string;
}

/** 某个阶段的进度汇总。 */
export interface StageProgress {
  stage: Stage;
  totalResources: number;
  completedResources: number;
  learningResources: number;
  wishlistResources: number;
  /** 该阶段自测题总数。 */
  quizTotal: number;
  /** 历史最好成绩（答对题数），从未作答为 0。 */
  quizBestScore: number;
  /** 是否已通过自测（正确率 >= 80%）。 */
  quizPassed: boolean;
  /** 是否解锁（前一阶段完成则解锁，第一阶段始终解锁）。 */
  unlocked: boolean;
  /** 是否已完成（资源全部完成且自测通过）。 */
  completed: boolean;
  /** 0–1 的完成度，用于进度条。 */
  completion: number;
}

/** 仪表盘聚合数据。 */
export interface DashboardSummary {
  user: User;
  stages: StageProgress[];
  overall: {
    totalResources: number;
    completedResources: number;
    learningResources: number;
    /** 0–1 */
    completion: number;
    /** 已完成阶段数。 */
    completedStages: number;
    /** 通过自测的阶段数。 */
    passedQuizzes: number;
    /** 累计投入小时数（按已完成资源估算）。 */
    estimatedHoursSpent: number;
  };
  /** 当前正在学的阶段（第一个未完成的已解锁阶段）。 */
  currentStage: StageId | null;
  /** 「继续学习」推荐：最近标记为 learning 的资源；没有则推荐当前阶段最短的未开始资源。 */
  continueLearning: Resource | null;
}

/** 统一的 API 错误响应体。 */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
