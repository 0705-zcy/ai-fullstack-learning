import type { Stage, StageId } from './types.js';

/**
 * 「AI 全栈开发工程师」的 6 个阶段。
 *
 * 这是整个平台的主线，顺序执行、逐阶段解锁。
 * 每个阶段都对应一组外部免费课程资源（见 apps/api/src/seed/resources*.ts）。
 */
export const STAGES: readonly Stage[] = [
  {
    id: 'foundation',
    order: 1,
    title: '编程基础精要',
    subtitle: 'TypeScript · React · Node · SQL',
    summary:
      '不重新教你编程，只把做 AI 应用真正用得上的那部分补齐：类型系统、组件与状态、HTTP API、数据库查询。会写代码的人可以快速过。',
    outcomes: [
      '用 TypeScript 定义清晰的接口类型，而不是到处 any',
      '写出带状态与副作用的 React 组件，并知道数据该放在哪一层',
      '用 Node 起一个带路由和 JSON 请求体的 HTTP 服务',
      '写出带 JOIN 和聚合的 SQL 查询，理解索引为什么重要',
    ],
    estimatedWeeks: 2,
    accent: 'sky',
  },
  {
    id: 'llm-core',
    order: 2,
    title: 'LLM 应用核心',
    subtitle: 'API 调用 · Prompt · 结构化输出 · 工具调用 · 流式',
    summary:
      '第一次真正把大模型接进自己的程序。重点不是「怎么问得更好」，而是怎么让模型的输出能被程序稳定消费。',
    outcomes: [
      '用兼容 OpenAI 协议的接口完成一次带重试和超时控制的调用',
      '把 prompt 当作代码来管理：版本化、可测试、可回滚',
      '让模型稳定返回符合 JSON Schema 的结构化数据',
      '实现一次工具调用循环，并处理模型不按格式返回的情况',
      '把流式响应接进 UI，并正确统计 token 与成本',
    ],
    estimatedWeeks: 2,
    accent: 'violet',
  },
  {
    id: 'rag',
    order: 3,
    title: '检索增强生成',
    subtitle: '切分 · Embedding · 向量检索 · 重排 · 评测',
    summary:
      '让模型回答它没被训练过的问题。RAG 的成败几乎全在检索质量上，所以这个阶段有一半时间花在评测上。',
    outcomes: [
      '按语义而不是按字数切分文档，并说明你的切分策略为什么合理',
      '生成并存储 embedding，实现语义检索',
      '用混合检索 + 重排把召回质量拉上一个台阶',
      '搭一套最小评测集，用数字而不是感觉判断 RAG 改好了没有',
    ],
    estimatedWeeks: 2,
    accent: 'emerald',
  },
  {
    id: 'agent',
    order: 4,
    title: '智能体与工具调用',
    subtitle: 'ReAct · 规划 · 记忆 · 多智能体 · 失败恢复',
    summary:
      '从「一问一答」走到「自己决定下一步做什么」。这个阶段最大的敌人不是能力不足，而是循环失控和错误累积。',
    outcomes: [
      '实现一个可靠的工具调用循环，带最大步数与终止条件',
      '用 ReAct 或等价范式拆解多步任务',
      '为智能体设计短期记忆与长期记忆的边界',
      '让智能体在工具报错时能自我纠正而不是原地崩溃',
    ],
    estimatedWeeks: 2,
    accent: 'amber',
  },
  {
    id: 'engineering',
    order: 5,
    title: '工程化与生产',
    subtitle: 'Eval · 可观测 · 成本 · 安全 · 部署',
    summary:
      '把 demo 变成能交付的东西。这一阶段的知识点是「面试会问、上线会踩」的那一类。',
    outcomes: [
      '为一套 AI 功能建立可回归的自动化评测',
      '接入链路追踪，能回答「这次调用慢在哪、贵在哪」',
      '设计缓存、降级与限流策略，让服务在模型抖动时仍然可用',
      '识别并防御提示注入与工具越权',
      '把服务部署上线，并用真实流量验证',
    ],
    estimatedWeeks: 2,
    accent: 'rose',
  },
  {
    id: 'capstone',
    order: 6,
    title: '综合项目实战',
    subtitle: '把前五个阶段拼成一个能交付的产品',
    summary:
      '毕业设计。目标不是「跑通」，而是有一个能放进作品集、能讲清楚每个技术决策为什么这么做的东西。',
    outcomes: [
      '独立完成一个包含 RAG 或 Agent 的完整全栈应用',
      '写清楚技术选型与取舍，能回答「为什么不用另一个方案」',
      '有评测数据、有部署地址、有可复现的 README',
    ],
    estimatedWeeks: 3,
    accent: 'indigo',
  },
];

/** 按 id 快速取阶段元数据。 */
export const STAGE_BY_ID: Readonly<Record<StageId, Stage>> = Object.freeze(
  Object.fromEntries(STAGES.map((stage) => [stage.id, stage])) as Record<StageId, Stage>,
);

/** 全部阶段 id，按学习顺序排列。 */
export const STAGE_IDS: readonly StageId[] = STAGES.map((stage) => stage.id);

/** 判断一个字符串是否是合法的阶段 id。 */
export function isStageId(value: unknown): value is StageId {
  return typeof value === 'string' && value in STAGE_BY_ID;
}

/** 通过自测的分数线（正确率）。 */
export const QUIZ_PASS_RATIO = 0.8;
