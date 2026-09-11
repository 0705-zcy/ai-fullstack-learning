import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { DEMO_READONLY } from '../api/index.js';
import { useAuth } from '../state/AuthContext.js';

const NAV_ITEMS = [
  { to: '/', label: '仪表盘', end: true },
  { to: '/path', label: '学习路径', end: false },
  { to: '/library', label: '资源库', end: false },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-900 text-sm text-white">
              AI
            </span>
            <span className="hidden sm:inline">全栈工程师</span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <>
                <span className="hidden text-sm text-slate-500 sm:inline">{user.displayName}</span>
                {DEMO_READONLY ? (
                  // 只读预览里没有「退出」这回事：退出了也会立刻被认回来
                  <span className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                    只读预览
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    退出
                  </button>
                )}
              </>
            ) : (
              <Link
                to="/login"
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                登录
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 py-6">
        <p className="mx-auto max-w-6xl px-4 text-xs text-slate-400">
          资源均为第三方免费课程，版权归各提供方所有；本平台只做导航与进度管理。
        </p>
      </footer>
    </div>
  );
}
