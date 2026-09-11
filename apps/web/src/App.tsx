import type { ReactNode } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { DEMO_MODE } from './api/index.js';
import { DemoBanner } from './components/DemoBanner.js';
import { Layout } from './components/Layout.js';
import { LoadingState } from './components/ui.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { LibraryPage } from './pages/LibraryPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { PathPage } from './pages/PathPage.js';
import { QuizPage } from './pages/QuizPage.js';
import { StagePage } from './pages/StagePage.js';
import { AuthProvider, useAuth } from './state/AuthContext.js';

/**
 * 演示模式改用 HashRouter：`npm run build:demo` 产出的静态文件
 * 可以直接双击打开或丢到任意静态托管上，不需要服务端 rewrite 规则。
 */
const Router = (DEMO_MODE ? HashRouter : BrowserRouter) as typeof BrowserRouter;

/** 未登录时重定向到登录页，并记住原本想去的地址。 */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingState message="正在校验登录状态…" />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

function NotFoundPage() {
  return (
    <div className="py-20 text-center">
      <p className="text-5xl font-bold text-slate-300">404</p>
      <p className="mt-3 text-sm text-slate-500">这个页面不存在。</p>
      <a
        href="/"
        className="mt-6 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        回到仪表盘
      </a>
    </div>
  );
}

export function App() {
  return (
    <Router>
      <AuthProvider>
        <DemoBanner />
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="/path" element={<PathPage />} />
            <Route path="/path/:stageId" element={<StagePage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/quiz/:stageId" element={<QuizPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}
