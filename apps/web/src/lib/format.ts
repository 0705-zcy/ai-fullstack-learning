import type { Difficulty, LanguageCode, ProgressStatus, ResourceFormat } from '@aifs/shared';

/** 阶段的 Tailwind 配色。必须写成静态类名，否则 Tailwind 扫描不到就不会生成样式。 */
export interface AccentClasses {
  bg: string;
  bgSoft: string;
  text: string;
  border: string;
  dot: string;
  ring: string;
  button: string;
}

export const STAGE_ACCENT: Record<string, AccentClasses> = {
  sky: {
    bg: 'bg-sky-500',
    bgSoft: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
    ring: 'ring-sky-200',
    button: 'bg-sky-600 hover:bg-sky-700',
  },
  violet: {
    bg: 'bg-violet-500',
    bgSoft: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
    dot: 'bg-violet-500',
    ring: 'ring-violet-200',
    button: 'bg-violet-600 hover:bg-violet-700',
  },
  emerald: {
    bg: 'bg-emerald-500',
    bgSoft: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-200',
    button: 'bg-emerald-600 hover:bg-emerald-700',
  },
  amber: {
    bg: 'bg-amber-500',
    bgSoft: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    ring: 'ring-amber-200',
    button: 'bg-amber-600 hover:bg-amber-700',
  },
  rose: {
    bg: 'bg-rose-500',
    bgSoft: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    ring: 'ring-rose-200',
    button: 'bg-rose-600 hover:bg-rose-700',
  },
  indigo: {
    bg: 'bg-indigo-500',
    bgSoft: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
    ring: 'ring-indigo-200',
    button: 'bg-indigo-600 hover:bg-indigo-700',
  },
};

const FALLBACK_ACCENT: AccentClasses = {
  bg: 'bg-slate-500',
  bgSoft: 'bg-slate-50',
  text: 'text-slate-700',
  border: 'border-slate-200',
  dot: 'bg-slate-500',
  ring: 'ring-slate-200',
  button: 'bg-slate-700 hover:bg-slate-800',
};

/** 取阶段配色，未知 accent 时退回中性色而不是崩掉。 */
export function accentOf(accent: string | undefined): AccentClasses {
  if (!accent) return FALLBACK_ACCENT;
  return STAGE_ACCENT[accent] ?? FALLBACK_ACCENT;
}

/** 把小时数渲染成人话："3 小时" / "1.5 小时" / "40 分钟"。 */
export function formatHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '时长未知';
  if (hours < 1) return `${Math.round(hours * 60)} 分钟`;
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded} 小时`;
}

/** 0–1 的完成度转成百分比整数。 */
export function toPercent(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

export const LANGUAGE_LABEL: Record<LanguageCode, string> = {
  zh: '中文',
  en: 'English',
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高阶',
};

export const FORMAT_LABEL: Record<ResourceFormat, string> = {
  video: '视频',
  docs: '文档',
  interactive: '交互式',
  course: '课程',
};

export const STATUS_LABEL: Record<ProgressStatus, string> = {
  wishlist: '想学',
  learning: '在学',
  completed: '已完成',
};

export const STATUS_ORDER: readonly ProgressStatus[] = ['wishlist', 'learning', 'completed'];

/**
 * 展示用域名：把长 URL 压成一眼能看出提供方的形式。
 * 解析失败时退回原串，绝不抛错。
 */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** ISO 时间转成「2024-05-01 10:00」这类本地短格式。 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}
