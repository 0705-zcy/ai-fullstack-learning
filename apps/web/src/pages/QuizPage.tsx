import type { StageId } from '@aifs/shared';
import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiRequestError, DEMO_READONLY, type QuizSubmissionResult } from '../api/index.js';
import { Badge, ErrorState, LoadingState } from '../components/ui.js';
import { accentOf } from '../lib/format.js';
import { useAsync } from '../state/hooks.js';

/**
 * 自测页。
 *
 * 一次列出全部题目（而不是逐题翻页）：题目少，一次看到全貌更好安排时间，
 * 也避免了「翻到第 5 题想改第 2 题」的交互麻烦。
 */
export function QuizPage() {
  const { stageId } = useParams<{ stageId: string }>();

  const quiz = useAsync(() => api.getQuiz(stageId as StageId), [stageId]);
  const stageMeta = useAsync(() => api.getStage(stageId as StageId), [stageId]);

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizSubmissionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const questions = useMemo(() => quiz.data?.questions ?? [], [quiz.data]);
  const answeredCount = Object.keys(answers).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  const accent = accentOf(stageMeta.data?.stage.accent);

  const handleSubmit = useCallback(async () => {
    if (!stageId) return;
    setSubmitting(true);
    setError(null);

    try {
      const payload = questions
        .filter((question) => answers[question.id] !== undefined)
        .map((question) => ({
          questionId: question.id,
          optionIndex: answers[question.id] as number,
        }));

      setResult(await api.submitQuiz(stageId as StageId, payload));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (cause) {
      setError(cause instanceof ApiRequestError ? cause.message : '提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }, [answers, questions, stageId]);

  const handleRetry = useCallback(() => {
    setAnswers({});
    setResult(null);
    setError(null);
  }, []);

  if (quiz.loading) return <LoadingState message="正在加载题目…" />;
  if (quiz.error) return <ErrorState message={quiz.error} onRetry={quiz.reload} />;

  const resultByQuestion = new Map(result?.results.map((item) => [item.questionId, item]) ?? []);

  return (
    <div className="space-y-6">
      <nav className="text-sm text-slate-500">
        <Link to="/path" className="hover:text-slate-900">
          学习路径
        </Link>
        <span className="mx-2">/</span>
        <Link to={`/path/${stageId}`} className="hover:text-slate-900">
          {stageMeta.data?.stage.title ?? stageId}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-900">自测</span>
      </nav>

      <header className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {stageMeta.data?.stage.title ?? '阶段'} · 自测
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          共 {questions.length} 道题，正确率 80%（即 {Math.ceil(questions.length * 0.8)} 题）以上算通过。
          提交后会给出每道题的解析。
        </p>
      </header>

      {/* 成绩卡：提交后置顶显示 */}
      {result && (
        <section
          className={`rounded-2xl border p-6 ${
            result.passed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
          }`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-3xl font-bold text-slate-900">
              {result.score}/{result.bankTotal}
            </span>
            <Badge tone={result.passed ? 'green' : 'amber'}>
              {result.passed ? '通过 ✅' : '未通过，再看一遍解析'}
            </Badge>
            <Badge>历史最好成绩 {result.bestScore}/{result.bankTotal}</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {result.passed
              ? '这个阶段的知识点你已经掌握得不错了，可以去下一阶段了。'
              : '没过线不代表学不会——下面每题都有解析，看完再来一次。'}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              重新作答
            </button>
            <Link
              to={`/path/${stageId}`}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              回到阶段资源
            </Link>
          </div>
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <ol className="space-y-4">
        {questions.map((question, index) => {
          const graded = resultByQuestion.get(question.id);
          const selected = answers[question.id];

          return (
            <li key={question.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {index + 1}
                </span>
                <p className="flex-1 text-sm font-medium leading-relaxed text-slate-900">
                  {question.prompt}
                </p>
                {graded && (
                  <Badge tone={graded.correct ? 'green' : 'rose'}>
                    {graded.correct ? '答对' : '答错'}
                  </Badge>
                )}
              </div>

              <div className="mt-3 space-y-2 pl-9">
                {question.options.map((option, optionIndex) => {
                  const isSelected = selected === optionIndex;
                  const isCorrectOption = graded && graded.correctIndex === optionIndex;
                  const isWrongPick = graded && isSelected && !graded.correct;

                  let style = 'border-slate-200 bg-white hover:bg-slate-50';
                  if (isCorrectOption) style = 'border-emerald-300 bg-emerald-50';
                  else if (isWrongPick) style = 'border-rose-300 bg-rose-50';
                  else if (isSelected) style = 'border-slate-900 bg-slate-50';

                  return (
                    <label
                      key={option}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm transition ${style}`}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={optionIndex}
                        checked={isSelected ?? false}
                        disabled={Boolean(result) || DEMO_READONLY}
                        onChange={() =>
                          setAnswers((prev) => ({ ...prev, [question.id]: optionIndex }))
                        }
                        className="mt-0.5"
                      />
                      <span className="break-anywhere text-slate-700">{option}</span>
                      {isCorrectOption && <span className="ml-auto text-xs text-emerald-700">正确答案</span>}
                    </label>
                  );
                })}
              </div>

              {graded && (
                <div className="mt-3 ml-9 rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-600">解析</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">{graded.explanation}</p>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {!result && questions.length > 0 && !DEMO_READONLY && (
        <div className="sticky bottom-4 flex items-center gap-4 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
          <p className="text-sm text-slate-500">
            已作答 {answeredCount}/{questions.length}
            {!allAnswered && ' · 还有题目没作答'}
          </p>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={answeredCount === 0 || submitting}
            className={`ml-auto rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 ${accent.button}`}
          >
            {submitting ? '提交中…' : '提交并查看解析'}
          </button>
        </div>
      )}

      {DEMO_READONLY && questions.length > 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          只读预览：题目可以浏览，但作答与提交已禁用，所以看不到判分与解析的效果。
        </p>
      )}

      {questions.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          这个阶段还没有自测题。
        </p>
      )}
    </div>
  );
}
