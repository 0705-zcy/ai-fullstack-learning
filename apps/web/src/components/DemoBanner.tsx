import { useState } from 'react';
import { DEMO_MODE } from '../api/index.js';
import { demoControls, demoMeta } from '../demo/mockApi.js';
import { useAuth } from '../state/AuthContext.js';

/**
 * 演示模式工具条。
 *
 * 固定悬浮在左下角，不改动页面布局；只在演示模式下渲染，
 * 真实部署时这段代码的渲染分支永远不会走到。
 *
 * 「填充示例进度」「重置」都走一次整页刷新 —— 这样所有数据 hook 都会重新拉取，
 * 不用在演示代码里维护一套跨组件的事件通知。演示场景下刷新完全可接受。
 */
export function DemoBanner() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  if (!DEMO_MODE) return null;

  function reload(): void {
    window.location.reload();
  }

  function handleFill(): void {
    demoControls.fillSampleProgress();
    reload();
  }

  function handleReset(): void {
    demoControls.reset();
    reload();
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title="展开演示工具条"
        className="fixed bottom-4 left-4 z-50 rounded-full border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900 shadow-lg hover:bg-amber-200"
      >
        演示模式
      </button>
    );
  }

  return (
    <aside className="fixed bottom-4 left-4 z-50 w-72 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs shadow-xl">
      <header className="flex items-center gap-2">
        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white">
          演示模式
        </span>
        <span className="text-amber-900">无需后端</span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          title="收起"
          className="ml-auto rounded px-1.5 text-amber-700 hover:bg-amber-200"
        >
          ✕
        </button>
      </header>

      <p className="mt-2 leading-relaxed text-amber-900">
        数据全部在浏览器里模拟，不会发往任何服务器；刷新不丢失。
        <br />
        课程与题目来自真实种子数据（{demoMeta.resourceCount} 个课程 · {demoMeta.questionCount} 道题）。
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleFill}
          disabled={!user}
          title={user ? '标记一批资源为已完成，并写入两条自测记录' : '请先登录'}
          className="flex-1 rounded-lg bg-amber-600 px-2 py-1.5 font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          填充示例进度
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-amber-400 bg-white px-2 py-1.5 font-medium text-amber-800 hover:bg-amber-100"
        >
          重置
        </button>
      </div>

      {!user && <p className="mt-2 text-amber-700">登录后即可填充示例进度。</p>}
    </aside>
  );
}
