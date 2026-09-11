import type { Difficulty, LanguageCode, ProgressStatus, ResourceFormat, StageId } from '@aifs/shared';
import { useCallback, useMemo } from 'react';
import { api } from '../api/index.js';
import { ResourceCard } from '../components/ResourceCard.js';
import { EmptyState, ErrorState, LoadingState } from '../components/ui.js';
import { useAsync, useProgressMap, useProgressMutation, useResourceFilters } from '../state/hooks.js';

const MAX_HOURS_OPTIONS = [
  { value: '', label: '不限时长' },
  { value: '3', label: '3 小时以内' },
  { value: '10', label: '10 小时以内' },
  { value: '20', label: '20 小时以内' },
] as const;

const SORT_OPTIONS = [
  { value: 'default', label: '按学习路径排序' },
  { value: 'duration-asc', label: '时长短 → 长' },
  { value: 'duration-desc', label: '时长长 → 短' },
  { value: 'title', label: '按标题' },
] as const;

function Select<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; disabled?: boolean }>;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-500">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-slate-900"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** 资源库：筛选 + 搜索 + 状态标记。 */
export function LibraryPage() {
  const { filters, update, reset, activeCount } = useResourceFilters();
  const resources = useAsync(() => api.listResources(filters), [JSON.stringify(filters)]);
  const progress = useProgressMap();
  const mutation = useProgressMutation(() => progress.reload());

  const facets = resources.data?.facets;

  const stageOptions = useMemo(
    () => [
      { value: '' as StageId | '', label: '全部阶段' },
      ...(facets?.stages.map((s) => ({
        value: s.id as StageId | '',
        label: `${s.title}（${s.count}）`,
      })) ?? []),
    ],
    [facets],
  );

  const handleSelect = useCallback(
    async (resourceId: string, status: ProgressStatus) => {
      progress.setLocal(resourceId, status);
      try {
        await mutation.setStatus(resourceId, status);
      } catch {
        progress.reload();
      }
    },
    [mutation, progress],
  );

  const handleClear = useCallback(
    async (resourceId: string) => {
      progress.clearLocal(resourceId);
      try {
        await mutation.clear(resourceId);
      } catch {
        progress.reload();
      }
    },
    [mutation, progress],
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">免费课程资源库</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          全部为可免费获取的外部课程与文档。资源分两类：
          <strong className="text-slate-700">完整体系课</strong>
          （从入门讲到能独立做出项目，有动手环节）与
          <strong className="text-slate-700">单点补充</strong>
          （官方文档、短课、专题文章）。默认排序会把体系课排在前面。
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2">
            <label htmlFor="q" className="block text-xs font-medium text-slate-500">
              搜索
            </label>
            <input
              id="q"
              type="search"
              value={filters.q ?? ''}
              onChange={(event) => update('q', event.target.value)}
              placeholder="标题、提供方、主题…"
              className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-slate-900"
            />
          </div>

          <Select
            id="filter-stage"
            label="阶段"
            value={(filters.stage ?? '') as StageId | ''}
            options={stageOptions}
            onChange={(value) => update('stage', value)}
          />

          <Select
            id="filter-language"
            label="语言"
            value={(filters.language ?? '') as LanguageCode | ''}
            options={[
              { value: '', label: '全部语言' },
              { value: 'zh', label: `中文${facets ? `（${facets.languages.find((l) => l.value === 'zh')?.count ?? 0}）` : ''}` },
              { value: 'en', label: `English${facets ? `（${facets.languages.find((l) => l.value === 'en')?.count ?? 0}）` : ''}` },
            ]}
            onChange={(value) => update('language', value)}
          />

          <Select
            id="filter-difficulty"
            label="难度"
            value={(filters.difficulty ?? '') as Difficulty | ''}
            options={[
              { value: '', label: '全部难度' },
              { value: 'beginner', label: '入门' },
              { value: 'intermediate', label: '进阶' },
              { value: 'advanced', label: '高阶' },
            ]}
            onChange={(value) => update('difficulty', value)}
          />

          <Select
            id="filter-format"
            label="形式"
            value={(filters.format ?? '') as ResourceFormat | ''}
            options={[
              { value: '', label: '全部形式' },
              { value: 'docs', label: '文档' },
              { value: 'video', label: '视频' },
              { value: 'interactive', label: '交互式' },
              { value: 'course', label: '课程' },
            ]}
            onChange={(value) => update('format', value)}
          />

          <Select
            id="filter-hours"
            label="时长"
            value={filters.maxHours === undefined || filters.maxHours === '' ? '' : String(filters.maxHours)}
            options={MAX_HOURS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            onChange={(value) => update('maxHours', value === '' ? '' : Number(value))}
          />

          <Select
            id="filter-sort"
            label="排序"
            value={filters.sort ?? 'default'}
            options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            onChange={(value) => update('sort', value)}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
          <label
            htmlFor="filter-scope"
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            <input
              id="filter-scope"
              type="checkbox"
              checked={filters.scope === 'curriculum'}
              onChange={(event) => update('scope', event.target.checked ? 'curriculum' : '')}
              className="h-3.5 w-3.5"
            />
            只看能完整学会的体系课
            {facets && <span className="text-slate-400">（{facets.curriculumCount} 门）</span>}
          </label>

          <p className="text-xs text-slate-500">
            共 {resources.data?.total ?? 0} 个资源
            {activeCount > 0 && ` · 已应用 ${activeCount} 个筛选条件`}
          </p>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={reset}
              className="text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
            >
              清空筛选
            </button>
          )}
        </div>
      </section>

      {mutation.error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {mutation.error}
        </p>
      )}

      {resources.loading || progress.loading ? (
        <LoadingState message="正在加载资源…" />
      ) : resources.error ? (
        <ErrorState message={resources.error} onRetry={resources.reload} />
      ) : (resources.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title={filters.scope === 'curriculum' ? '这个条件下没有完整体系课' : '没有符合条件的资源'}
          description={
            filters.scope === 'curriculum'
              ? '试试取消「只看体系课」，或者清空其他筛选条件。体系课数量本就不多——一门能走完的课比十篇碎片文章更有价值。'
              : '试着放宽筛选条件，或者清空筛选看看全部内容。'
          }
          action={
            <button
              type="button"
              onClick={reset}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              清空筛选
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {resources.data?.items.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              status={progress.map.get(resource.id)}
              busy={mutation.pending.has(resource.id)}
              onSelectStatus={(status) => handleSelect(resource.id, status)}
              onClearStatus={() => handleClear(resource.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
