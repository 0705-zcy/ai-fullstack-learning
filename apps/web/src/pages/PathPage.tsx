import { Link } from 'react-router-dom';
import { Badge, ErrorState, LoadingState, ProgressBar } from '../components/ui.js';
import { accentOf, toPercent } from '../lib/format.js';
import { stageLockReason } from '../lib/progress-utils.js';
import { useDashboard } from '../state/hooks.js';

/** 学习路径：6 个阶段的时间线，展示依赖关系与进度。 */
export function PathPage() {
  const { data, loading, error, reload } = useDashboard();

  if (loading) return <LoadingState message="正在加载学习路径…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">AI 全栈工程师学习路径</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
          六个阶段，按顺序推进。每个阶段给出若干<strong>免费</strong>课程供你挑选
          （不同语言、难度与形式），学完做一次自测确认掌握程度。
          前一阶段完成度达到 80% 即可提前解锁下一阶段。
        </p>
      </header>

      <ol className="relative space-y-4 border-l-2 border-slate-200 pl-6">
        {data.stages.map((item, index) => {
          const accent = accentOf(item.stage.accent);
          const previous = data.stages[index - 1];
          const lockReason = stageLockReason(item, previous?.stage.title);

          return (
            <li key={item.stage.id} className="relative">
              {/* 时间线节点 */}
              <span
                className={`absolute -left-[31px] top-5 grid h-4 w-4 place-items-center rounded-full border-2 border-white ${
                  item.completed ? 'bg-emerald-500' : item.unlocked ? accent.dot : 'bg-slate-300'
                }`}
                aria-hidden="true"
              />

              <section
                className={`rounded-xl border bg-white p-5 ${
                  item.unlocked ? 'border-slate-200' : 'border-dashed border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs font-semibold ${accent.text}`}>
                    阶段 {item.stage.order}
                  </span>
                  <h2 className="text-lg font-semibold text-slate-900">{item.stage.title}</h2>
                  <span className="text-sm text-slate-400">{item.stage.subtitle}</span>

                  <span className="ml-auto flex gap-2">
                    {item.completed && <Badge tone="green">已完成</Badge>}
                    {!item.unlocked && <Badge>未解锁</Badge>}
                    <Badge tone="violet">建议 {item.stage.estimatedWeeks} 周</Badge>
                  </span>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.stage.summary}</p>

                <div className={`mt-4 rounded-lg ${accent.bgSoft} p-4`}>
                  <p className="text-xs font-semibold text-slate-700">学完你应该能做到</p>
                  <ul className="mt-2 space-y-1.5">
                    {item.stage.outcomes.map((outcome) => (
                      <li key={outcome} className="flex gap-2 text-sm text-slate-700">
                        <span className={accent.text}>✓</span>
                        <span>{outcome}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4">
                  <ProgressBar
                    ratio={item.completion}
                    accentClass={accent.bg}
                    label={`${item.stage.title} 进度`}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>
                      资源 {item.completedResources}/{item.totalResources}
                    </span>
                    <span>
                      自测最好成绩 {item.quizBestScore}/{item.quizTotal || '—'}
                      {item.quizPassed && item.quizTotal > 0 && ' ✅'}
                    </span>
                    <span className="font-medium text-slate-700">{toPercent(item.completion)}%</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {item.unlocked ? (
                    <>
                      <Link
                        to={`/path/${item.stage.id}`}
                        className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${accent.button}`}
                      >
                        查看资源与自测
                      </Link>
                      {item.quizTotal > 0 && (
                        <Link
                          to={`/quiz/${item.stage.id}`}
                          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          直接做自测
                        </Link>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">{lockReason}</p>
                  )}
                </div>
              </section>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
