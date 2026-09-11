import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiRequestError, DEMO_MODE } from '../api/index.js';
import { STAGES } from '@aifs/shared';
import { DEMO_CREDENTIALS } from '../demo/mockApi.js';
import { useAuth } from '../state/AuthContext.js';

type Mode = 'login' | 'register';

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const { user, loading, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 演示模式预填凭据并默认走登录，省掉手输；真实模式默认走注册（新用户更多）
  const [mode, setMode] = useState<Mode>(DEMO_MODE ? 'login' : 'register');
  const [email, setEmail] = useState(DEMO_MODE ? DEMO_CREDENTIALS.email : '');
  const [password, setPassword] = useState(DEMO_MODE ? DEMO_CREDENTIALS.password : '');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return <div className="grid min-h-full place-items-center text-sm text-slate-500">加载中…</div>;
  }

  if (user) {
    const target = (location.state as LocationState | null)?.from?.pathname ?? '/';
    return <Navigate to={target} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'register') {
        await register(email, password, displayName.trim() || undefined);
      } else {
        await login(email, password);
      }
      navigate((location.state as LocationState | null)?.from?.pathname ?? '/', { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiRequestError ? cause.message : '操作失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      {/* 左侧：产品定位说明 */}
      <section className="hidden flex-col justify-center bg-slate-900 px-12 py-16 text-slate-100 lg:flex">
        <h1 className="text-3xl font-bold">成为 AI 全栈开发工程师</h1>
        <p className="mt-4 max-w-md leading-relaxed text-slate-300">
          不重复造课程。这里做的是把互联网上<strong className="text-white">真正免费的优质课程</strong>
          组织成一条可执行的路线，再用自测题和进度追踪确保你真的学会了。
        </p>

        <ol className="mt-10 space-y-3">
          {STAGES.map((stage) => (
            <li key={stage.id} className="flex items-baseline gap-3 text-sm">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-700 text-xs font-semibold">
                {stage.order}
              </span>
              <span>
                <span className="font-medium text-white">{stage.title}</span>
                <span className="ml-2 text-slate-400">{stage.subtitle}</span>
              </span>
            </li>
          ))}
        </ol>

        <p className="mt-10 text-xs text-slate-500">
          建议总投入约 13 周 · 注册只需邮箱，进度自动云端同步
        </p>
      </section>

      {/* 右侧：登录 / 注册 */}
      <section className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-slate-900">
            {mode === 'register' ? '创建账号，开始学习' : '欢迎回来'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'register'
              ? '进度会保存在你的账号下，换设备也能接着学。'
              : '登录后继续上次的进度。'}
          </p>

          {DEMO_MODE && (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
              <strong>演示模式</strong>：邮箱密码已预填，直接点登录即可。
              数据只在浏览器里模拟，右下角工具条可以一键填充示例进度或重置。
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                邮箱
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                密码
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 8 位"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              />
            </div>

            {mode === 'register' && (
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-slate-700">
                  昵称 <span className="font-normal text-slate-400">（可选）</span>
                </label>
                <input
                  id="displayName"
                  type="text"
                  maxLength={40}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="留空则用邮箱前缀"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? '处理中…' : mode === 'register' ? '注册并开始' : '登录'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === 'register' ? '已经有账号了？' : '还没有账号？'}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'register' ? 'login' : 'register');
                setError(null);
              }}
              className="ml-1 font-medium text-slate-900 underline underline-offset-2"
            >
              {mode === 'register' ? '去登录' : '去注册'}
            </button>
          </p>
        </div>
      </section>
    </div>
  );
}
