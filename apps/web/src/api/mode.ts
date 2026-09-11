/**
 * 运行模式判断。
 *
 * 单独成一个模块（而不是写在 api/index.ts 里），是因为 mockApi 也需要读这两个标志，
 * 而 api/index.ts 又反过来 import mockApi —— 放在一起会形成循环依赖。
 */

/** 演示模式：不起后端，数据全在浏览器里模拟。由 `vite --mode demo` 打开。 */
export const DEMO_MODE = import.meta.env.VITE_AIFS_DEMO === '1';

/**
 * 只读预览：演示模式下进一步禁止所有写操作。
 *
 * 用途是「给别人看界面」，不是「给别人用产品」：
 * 访问者可以浏览每一个页面、用筛选器、看自测题，
 * 但标记进度、交卷、注册全部关闭，且无需登录（自动以预览身份进入）。
 *
 * 由 `vite --mode preview` 打开（读取 .env.preview）。
 */
export const DEMO_READONLY = DEMO_MODE && import.meta.env.VITE_DEMO_READONLY === '1';
