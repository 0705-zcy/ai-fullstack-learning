import { useState } from 'react';
import { DEMO_MODE, DEMO_READONLY } from '../api/index.js';
import { demoControls, demoMeta } from '../demo/mockApi.js';
import { useAuth } from '../state/AuthContext.js';

/**
 * 演示模式工具条。
 *
 * 固定悬浮在左下角，不改动页面布局；只在演示模式下渲染，
 * 真实部署时这段代码的渲染分支永远不会走到。
 *
 * 两种形态：
 *  - 可交互演示：提供「填充示例进度」「重置」，走整页刷新让所有 hook 重新拉取
 *  - 只读预览：不给任何操作按钮，只说明「操作已禁用」
 */
export function DemoBanner() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  if (!DEMO_MODE) return null;

  function reload(): void {
    window.location.reload();
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title="展开说明"
        className="fixed bottom-4 left-4 z-50 rounded-full border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900 shadow-lg hover:bg-amber-200"
      >
        {DEMO_READONLY ? '只读预览' : '演示模式'}
      </button>
    );
  }

  return (
    <aside className="fixed bottom-4 left-4 z-50 w-72 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs shadow-xl">
      <header className="flex items-center gap-2">
        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white">
          {DEMO_READONLY ? '只读预览' : '演示模式'}
        </span>
        <span className="text-amber-900">{DEMO_READONLY ? '仅供查看' : '无需后端'}</span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          title="收起"
          className="ml-auto rounded px-1.5 text-amber-700 hover:bg-amber-200"
        >
          ✕
        </button>
      </header>

      {DEMO_READONLY ? (
        <>
          <p className="mt-2 leading-relaxed text-amber-900">
            这是界面预览，<strong>所有操作已禁用</strong>：标记进度、提交自测、注册都不可用。
            <br />
            页面里的进度与成绩是预置的示例数据。
          </p>
          <p className="mt-2 text-amber-700">
            课程与题目为真实数据：{demoMeta.resourceCount} 个课程 · {demoMeta.questionCount} 道题。
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 leading-relaxed text-amber-900">
            数据全部在浏览器里模拟，不会发往任何服务器；刷新不丢失。
            <br />
            课程与题目来自真实种子数据（{demoMeta.resourceCount} 个课程 · {demoMeta.questionCount} 道题）。
          </p>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                demoControls.fillSampleProgress();
                reload();
              }}
              disabled={!user}
              title={user ? '标记一批资源为已完成，并写入两条自测记录' : '请先登录'}
              className="flex-1 rounded-lg bg-amber-600 px-2 py-1.5 font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              填充示例进度
            </button>
            <button
              type="button"
              onClick={() => {
                demoControls.reset();
                reload();
              }}
              className="rounded-lg border border-amber-400 bg-white px-2 py-1.5 font-medium text-amber-800 hover:bg-amber-100"
            >
              重置
            </button>
          </div>

          {!user && <p className="mt-2 text-amber-700">登录后即可填充示例进度。</p>}
        </>
      )}
    </aside>
  );
}
