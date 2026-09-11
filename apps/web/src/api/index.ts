import { mockApi } from '../demo/mockApi.js';
import { api as realApi } from './client.js';

/**
 * API 入口：根据运行模式在「真实后端」和「浏览器内 mock」之间切换。
 *
 * 用一个入口而不是散落的 if：页面代码只认 `api`，完全不需要知道当前跑在哪种模式下。
 *
 * 演示模式通过 `vite --mode demo` 打开（读取 apps/web/.env.demo）。
 * 两种实现共享同一个类型 `ApiClient`，所以 mock 少实现或多实现一个方法都会在编译期报错。
 */
export const DEMO_MODE = import.meta.env.VITE_AIFS_DEMO === '1';

export const api = DEMO_MODE ? mockApi : realApi;

// 页面需要的错误类型与辅助函数统一从这个入口再导出，
// 避免各处混用 './client.js' 和 './index.js' 两条路径。
export {
  ApiRequestError,
  toQueryString,
  type ApiClient,
  type QuizQuestionPublic,
  type QuizSubmissionResult,
  type ResourceFacets,
  type ResourceQuery,
} from './client.js';
