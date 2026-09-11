import type { ProgressStatus, StageId } from '@aifs/shared';
import { useCallback, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/index.js';
import { ResourceCard } from '../components/ResourceCard.js';
import { Badge, ErrorState, EmptyState, LoadingState, ProgressBar } from '../components/ui.js';
import { accentOf, formatHours, toPercent } from '../lib/format.js';
import { useAsync, useProgressMap, useProgressMutation } from '../state/hooks.js';

/** 单个阶段的详情页：学习成果、资源清单、自测入口。 */
export function StagePage() {
  const { stageId } = useParams<{ stageId: string }>();

  const stage = useAsync(() => api.getStage(stageId as StageId), [stageId]);
  const progress = useProgressMap();
  const mutation = useProgressMutation(() => progress.reload());

  const reloadAll = useCallback(() => {
    stage.reload();
    progress.reload();
  }, [stage, progress]);

  const resources = useMemo(() => stage.data?.resources ?? [], [stage.data]);

  const completedCount = resources.filter(
    (resource) => progress.map.get(resource.id) === 'completed',
  ).length;

  const handleSelect = useCallback(
    async (resourceId: string, status: ProgressStatus) => {
      // 乐观更新：先把界面改掉，失败再回滚（由 reload 兜底）
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

  if (stage.loading || progress.loading) return <LoadingState message="正在加载阶段内容…" />;
  if (stage.error) return <ErrorState message={stage.error} onRetry={reloadAll} />;
  if (!stage.data) return null;

  const { stage: meta, quizTotal } = stage.data;
  const accent = accentOf(meta.accent);
  const ratio = resources.length === 0 ? 0 : completedCount / resources.length;

  return (
    <div className="space-y-8">
      <nav className="text-sm text-slate-500">
        <Link to="/path" className="hover:text-slate-900">
          学习路径
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-900">{meta.title}</span>
      </nav>

      <header className={`rounded-2xl border ${accent.border} ${accent.bgSoft} p-6`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs font-semibold ${accent.text}`}>阶段 {meta.order}</span>
          <Badge tone="violet">建议 {meta.estimatedWeeks} 周</Badge>
          <Badge>共 {resources.length} 个免费资源</Badge>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{meta.title}</h1>
        <p className="text-sm text-slate-500">{meta.subtitle}</p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-700">{meta.summary}</p>

        <div className="mt-5">
          <ProgressBar
            ratio={ratio}
            accentClass={accent.bg}
            label={`${meta.title} 资源完成度`}
          />
          <p className="mt-2 text-xs text-slate-600">
            已完成 {completedCount}/{resources.length} 个资源（{toPercent(ratio)}%）
          </p>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">学完这个阶段，你应该能做到</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {meta.outcomes.map((outcome) => (
            <li key={outcome} className="flex gap-2 text-sm text-slate-700">
              <span className={accent.text}>✓</span>
              <span>{outcome}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 自测入口放在资源之前：先告诉用户「怎么算学会」，再看资源 */}
      <section className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex-1">
          <h2 className="text-base font-semibold text-slate-900">阶段自测</h2>
          <p className="mt-1 text-sm text-slate-500">
            {quizTotal > 0
              ? `${quizTotal} 道题，正确率 80% 以上算通过。答错会给出解析。`
              : '这个阶段还没有题目。'}
          </p>
        </div>
        {quizTotal > 0 && (
          <Link
            to={`/quiz/${meta.id}`}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${accent.button}`}
          >
            开始自测
          </Link>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">推荐资源</h2>
          <p className="text-xs text-slate-500">
            挑一个开始就行，不必全做。总时长约{' '}
            {formatHours(resources.reduce((sum, r) => sum + r.durationHours, 0))}
          </p>
        </div>

        {mutation.error && (
          <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {mutation.error}
          </p>
        )}

        {resources.length === 0 ? (
          <EmptyState
            title="这个阶段还没有资源"
            description="资源库还在补充中，可以先看看其他阶段。"
            action={
              <Link to="/library" className="text-sm font-medium text-slate-900 underline">
                去资源库
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {resources.map((resource) => (
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
      </section>
    </div>
  );
}
