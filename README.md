# AI 全栈开发工程师 · 学习平台

一个「免费课程导航 + 学习路径 + 阶段自测 + 进度追踪」的学习平台。

**它不生产课程内容。** 互联网上已经有大量高质量且真正免费的课程，问题从来不是「没有资源」，而是「资源太多、不知道学什么、学完不知道会不会」。这个平台解决后半个问题：

```
今天该学什么 → 打开课程 → 被检验 → 知道自己学会了没 → 知道下一步
```

## 功能

| 模块 | 说明 |
| --- | --- |
| **学习路径** | 6 个阶段（基础 → LLM 核心 → RAG → Agent → 工程化 → 综合项目），按顺序解锁，前一阶段完成度达 80% 可提前解锁下一阶段 |
| **资源库** | 收录的免费课程，支持按阶段 / 语言 / 难度 / 形式 / 时长筛选与关键词搜索 |
| **阶段自测** | 每个阶段 6 道选择题，正确率 80% 通过，答错给解析。**这是平台自己产出的唯一内容** |
| **进度追踪** | 资源可标记「想学 / 在学 / 已完成」，自动汇总阶段与整体进度、累计投入时长 |
| **账号同步** | 邮箱注册登录，进度存服务端，换设备接着学 |
| **仪表盘** | 我在哪、下一步学什么、一键继续 |

## 技术栈

```
apps/web        React 19 + TypeScript + Vite + Tailwind v4 + React Router
apps/api        Hono + node:sqlite + zod + JWT（httpOnly cookie）
packages/shared 前后端共享的领域类型、阶段定义与校验 schema
```

**零原生依赖**：数据库用 Node 内置的 `node:sqlite`，密码哈希用内置 `node:crypto` 的 scrypt。
不需要 better-sqlite3、不需要 bcrypt、不需要编译工具链 —— `git clone` 后直接能跑。

## 快速开始

要求 **Node.js >= 22.5**（需要 `node:sqlite`）。

```bash
npm install
npm run dev
```

- 前端：http://localhost:5173
- 后端：http://localhost:8787

首次启动会自动灌入种子数据（免费课程 + 自测题），所以不需要额外的初始化步骤。

打开前端后注册一个账号即可开始。

## 常用命令

```bash
npm run dev          # 同时启动前后端（Vite 代理 /api 到后端，同源无跨域）
npm run dev:api      # 只启动后端（tsx watch）
npm run dev:web      # 只启动前端

npm test             # 跑全部测试（shared + api + web）
npm run typecheck    # 全量类型检查
npm run build        # 构建 shared、api 与 web

npm run seed         # 手动重灌种子数据（幂等，不会删掉已有进度）
npm start            # 生产模式启动后端（需先 npm run build）
```

## 环境变量

全部可选，不配也能跑（见 `.env.example`）。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `AIFS_PORT` | `8787` | 后端端口 |
| `AIFS_DB_PATH` | `./data/aifs.db` | SQLite 文件路径，可设为 `:memory:` |
| `AIFS_JWT_SECRET` | 开发默认值 | **生产环境必须设置**，否则启动直接报错 |
| `AIFS_WEB_ORIGIN` | `http://localhost:5173` | CORS 允许的前端来源 |
| `AIFS_API_TARGET` | `http://localhost:8787` | 仅前端 Vite 代理使用 |

## 目录结构

```
apps/api/src/
├── app.ts                Hono 应用组装（依赖注入，便于测试）
├── config.ts             环境变量与常量
├── db/                   node:sqlite 封装与版本化迁移
├── domain/               纯函数业务逻辑：进度计算、判卷（全部有单测）
├── lib/                  密码哈希、JWT 会话、错误、请求校验
├── repositories/         数据访问层
├── routes/               HTTP 路由
└── seed/                 课程资源与题库（含数据校验）

apps/web/src/
├── api/client.ts         类型化 API 客户端
├── components/           Layout、ResourceCard、通用 UI 原子
├── lib/                  格式化与进度工具（纯函数，有单测）
├── pages/                登录 / 仪表盘 / 路径 / 阶段 / 资源库 / 自测
└── state/                AuthContext 与数据获取 hooks
```

## 文档

| 文档 | 内容 |
| --- | --- |
| [docs/PRD.md](docs/PRD.md) | **产品设计文档**：定位、目标用户、功能设计、信息架构、指标与版本规划 |
| [docs/MVP.md](docs/MVP.md) | MVP 范围决策：为什么做这五个模块、为什么不做什么、接受了哪些取舍 |

## 设计取舍

几个刻意的决定，以及为什么：

- **课程正文不落库、不搬运**，只存标题、链接、元信息与说明 —— 避免版权问题，也让资源更新只需改 URL。
- **题库是自产内容**，所以有 `seed/validate.ts` 做机器校验（选项数、答案下标越界、每阶段最少题数）。一条错数据会静默毁掉学习体验，值得用测试兜住。
- **题目接口永不下发答案**，判卷在服务端做，只返回结果与解析。否则打开 DevTools 就能看到答案。
- **进度计算是纯函数**（`domain/progress.ts`），不碰数据库，因此能覆盖各种边界情况：空阶段、无题库、只交部分题、自测过线但资源没做完。
- **没有引入 react-query / zod 之外的状态库**：MVP 的数据获取需求只有「加载 + 重试 + 刷新」，自己写 30 行比多一个依赖更容易讲清楚。
- **认证用 httpOnly cookie 而非 localStorage 存 token**：前端 JS 读不到会话，降低 XSS 窃取风险；开发时靠 Vite 代理保证同源，`SameSite=Lax` 即可挡住 CSRF。

## 测试

```bash
npm test
```

覆盖重点：

- `packages/shared` —— 阶段定义一致性与校验 schema（含「schema 里的字面量和阶段定义是否漂移」的断言）
- `apps/api/domain` —— 进度计算与判卷的边界情况
- `apps/api/routes` —— 认证、鉴权、越权隔离、参数校验、答案不泄露
- `apps/api/seed` —— 种子数据完整性（链接是 https、每阶段资源与题量达标、id 唯一）
- `apps/web/lib`、`components` —— 纯函数与资源卡片交互

## 后续（MVP 之外）

按价值排序：

1. **AI 陪练**：在阶段页接入一个带课时上下文的对话面板（当前 MVP 刻意不做）
2. **代码沙箱**：Monaco + 浏览器内运行，把「看懂」变成「写出来」
3. **学习笔记**：按资源记录自己的心得，导出 Markdown
4. **资源社区投稿**：让用户推荐课程，审核后入库
5. **评测驱动的内容迭代**：用答题数据找出「大家都答错的题」，反推是题目有问题还是资源没讲清楚
