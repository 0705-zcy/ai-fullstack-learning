import type { ProgressStatus, Resource } from '@aifs/shared';
import {
  hostnameOf,
  DIFFICULTY_LABEL,
  FORMAT_LABEL,
  LANGUAGE_LABEL,
  SCOPE_LABEL,
  formatHours,
  STATUS_LABEL,
} from '../lib/format.js';
import { Badge } from './ui.js';

const STATUS_TONE: Record<ProgressStatus, 'slate' | 'blue' | 'green'> = {
  wishlist: 'slate',
  learning: 'blue',
  completed: 'green',
};

const STATUS_ACTIVE_CLASS: Record<ProgressStatus, string> = {
  wishlist: 'bg-slate-700 text-white border-slate-700',
  learning: 'bg-sky-600 text-white border-sky-600',
  completed: 'bg-emerald-600 text-white border-emerald-600',
};

export interface ResourceCardProps {
  resource: Resource;
  status?: ProgressStatus;
  busy?: boolean;
  onSelectStatus?: (status: ProgressStatus) => void;
  onClearStatus?: () => void;
}

/**
 * 资源卡片：展示外部免费课程，并提供「想学 / 在学 / 已完成」三档状态切换。
 *
 * 外链一律用 target="_blank" + rel="noreferrer"，避免把 referrer 和 window.opener 交给第三方站。
 */
export function ResourceCard({
  resource,
  status,
  busy = false,
  onSelectStatus,
  onClearStatus,
}: ResourceCardProps) {
  const interactive = Boolean(onSelectStatus);

  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow">
      <header className="flex items-start justify-between gap-3">
        <h3 className="break-anywhere text-base font-semibold text-slate-900">
          <a
            href={resource.url}
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-sky-700 hover:underline"
          >
            {resource.title}
          </a>
        </h3>
        <span className="flex shrink-0 items-center gap-1.5">
          {/* 体系课标记放在最显眼的位置：用户最先想知道的
              就是「这门课能不能把我带到底」 */}
          {resource.scope === 'curriculum' && (
            <Badge tone="green">🎓 {SCOPE_LABEL.curriculum}</Badge>
          )}
          {status && <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>}
        </span>
      </header>

      <p className="mt-1 text-xs text-slate-500">
        {resource.provider} · {hostnameOf(resource.url)}
        {!resource.verified && ' · ⚠️ 链接未核实'}
      </p>

      <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{resource.description}</p>

      {resource.notes && (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          {resource.notes}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge>{LANGUAGE_LABEL[resource.language]}</Badge>
        <Badge>{DIFFICULTY_LABEL[resource.difficulty]}</Badge>
        <Badge>{FORMAT_LABEL[resource.format]}</Badge>
        <Badge tone="violet">{formatHours(resource.durationHours)}</Badge>
      </div>

      {interactive && (
        <footer className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3">
          <span className="mr-auto text-xs text-slate-400">标记进度</span>
          {(['wishlist', 'learning', 'completed'] as const).map((option) => (
            <button
              key={option}
              type="button"
              disabled={busy}
              aria-pressed={status === option}
              onClick={() => onSelectStatus?.(option)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                status === option
                  ? STATUS_ACTIVE_CLASS[option]
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {STATUS_LABEL[option]}
            </button>
          ))}
          {status && onClearStatus && (
            <button
              type="button"
              disabled={busy}
              onClick={onClearStatus}
              title="取消标记"
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-400 hover:bg-slate-50 hover:text-rose-600 disabled:opacity-50"
            >
              清除
            </button>
          )}
        </footer>
      )}
    </article>
  );
}
