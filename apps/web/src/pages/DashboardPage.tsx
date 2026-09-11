import type { StageProgress } from '@aifs/shared';
import { Link } from 'react-router-dom';
import { Badge, ErrorState, LoadingState, ProgressBar } from '../components/ui.js';
import { accentOf, formatHours, toPercent } from '../lib/format.js';
import { useDashboard } from '../state/hooks.js';
import { useAuth } from '../state/AuthContext.js';

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function StageCard({ item }: { item: StageProgress }) {
  const accent = accentOf(item.stage.accent);
  const percent = toPercent(item.completion);

  return (
    <Link
      to={item.unlocked ? `/path/${item.stage.id}` : '/path'}
      className={`group block rounded-xl border bg-white p-4 transition ${
        item.unlocked
          ? 'border-slate-200 hover:border-slate-300 hover:shadow'
          : 'border-dashed border-slate-200 opacity-70'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${accent.dot}`} />
        <span className="text-xs font-medium text-slate-500">阶段 {item.stage.order}</span>
        {item.completed && <Badge tone="green">已完成</Badge>}
        {!item.unlocked && <Badge>未解锁</Badge>}
        {item.unlocked && !item.completed && item.learningResources > 0 && (
          <Badge tone="blue">进行中</Badge>
        )}
      </div>

      <h3 className="mt-2 font-semibold text-slate-900">{item.stage.title}</h3>
      <p className="mt-0.5 text-xs text-slate-500">{item.stage.subtitle}</p>

      <div className="mt-3">
        <ProgressBar ratio={item.completion} accentClass={accent.bg} label={`${item.stage.title} 进度`} />
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span>
            资源 {item.completedResources}/{item.totalResources}
          </span>
          <span>
            自测 {item.quizBestScore}/{item.quizTotal || '—'}
          </span>
          <span className="font-medium text-slate-700">{percent}%</span>
        </div>
      </div>
    </Link>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useDashboard();

  if (loading) return <LoadingState message="正在加载你的学习进度…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const { overall, stages, continueLearning } = data;
  const percent = toPercent(overall.completion);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          你好，{user?.displayName ?? '学习者'} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {overall.completedStages === 0
            ? '从第一个阶段开始，先把工具链和基础补齐。'
            : `已经完成 ${overall.completedStages} 个阶段，保持这个节奏。`}
        </p>
      </header>

      {/* 继续学习：仪表盘上最重要的一个动作 */}
      {continueLearning && (
        <section className="rounded-2xl border border-slate-900 bg-slate-900 p-6 text-white">
          <p className="text-xs font-medium tracking-wide text-slate-400">继续学习</p>
          <h2 className="break-anywhere mt-2 text-xl font-semibold">{continueLearning.title}</h2>
          <p className="mt-1 text-sm text-slate-300">
            {continueLearning.provider} · {formatHours(continueLearning.durationHours)} ·{' '}
            {continueLearning.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={continueLearning.url}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              打开课程 ↗
            </a>
            <Link
              to={`/path/${continueLearning.stage}`}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              查看该阶段
            </Link>
          </div>
        </section>
      )}

      {/* 总览数据 */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="总体进度"
          value={`${percent}%`}
          hint={`${overall.completedResources}/${overall.totalResources} 个资源已完成`}
        />
        <StatCard
          label="已完成阶段"
          value={`${overall.completedStages}/6`}
          hint={`通过自测 ${overall.passedQuizzes} 个`}
        />
        <StatCard label="在学资源" value={String(overall.learningResources)} hint="标记为「在学」" />
        <StatCard
          label="累计投入"
          value={formatHours(overall.estimatedHoursSpent)}
          hint="按已完成资源时长估算"
        />
      </section>

      {/* 阶段总览 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">学习路径</h2>
          <Link to="/path" className="text-sm text-slate-500 hover:text-slate-900">
            查看完整路线 →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stages.map((item) => (
            <StageCard key={item.stage.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
