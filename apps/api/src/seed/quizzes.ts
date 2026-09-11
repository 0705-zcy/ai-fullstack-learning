import type { QuizQuestion } from '@aifs/shared';

/**
 * 自测题库。
 *
 * 这是平台自己产出的唯一内容——资源是外部链接，题目必须自己做，
 * 否则「检验」这一环就断了，学习闭环也就不成立。
 *
 * 出题原则：
 *  - 考理解与判断，不考 API 记忆和名词解释
 *  - 错误选项要是「看起来合理的常见误解」，而不是明显凑数
 *  - 解析必须讲清「为什么」，最好补一句实践建议
 */
export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  // ============ 阶段 1：编程基础精要 ============
  {
    id: 'foundation-q1',
    stage: 'foundation',
    prompt: 'TypeScript 里 `unknown` 和 `any` 最关键的区别是什么？',
    options: [
      'unknown 性能更好，any 有运行时开销',
      'unknown 必须先收窄类型才能使用，any 则完全跳过类型检查',
      'unknown 只能用作函数返回值',
      '两者完全等价，只是团队风格约定不同',
    ],
    answerIndex: 1,
    explanation:
      'unknown 是类型安全的顶层类型：任何值都能赋给它，但要用它就必须先做类型收窄（typeof、in、类型守卫）。any 则彻底关闭检查，错误被推迟到运行时。接第三方 JSON 时用 unknown 接住再校验，比 any 少一类线上事故。',
    difficulty: 'beginner',
  },
  {
    id: 'foundation-q2',
    stage: 'foundation',
    prompt: '两个兄弟组件需要共享同一份会变化的数据，最合适的做法是？',
    options: [
      '各自用自己的 useState，通过 props 互传回调同步',
      '把状态提升到最近的共同父组件，或放进 Context / 状态库',
      '用一个模块级全局变量存这份数据',
      '用 setInterval 轮询，保证两边一致',
    ],
    answerIndex: 1,
    explanation:
      '两个组件要看到同一份数据，就必须共享同一个数据源——提到最近的共同祖先，或放进 Context。全局变量不会触发重渲染，用户看到的界面不会更新；轮询则是在给不同步打补丁。',
    difficulty: 'beginner',
  },
  {
    id: 'foundation-q3',
    stage: 'foundation',
    prompt: '在 Node 里读取 HTTP 请求体时，为什么不能假设一次 data 事件就是完整内容？',
    options: [
      '因为 Node 会自动压缩数据',
      '因为 HTTP 跑在 TCP 流上，请求体可能被拆成多个 chunk 分批到达',
      '因为 JSON 解析器一次只能处理一小段',
      '因为 Node 默认只读取前 8KB',
    ],
    answerIndex: 1,
    explanation:
      'HTTP 基于 TCP 流，一个请求体可能跨越多个数据包。正确做法是累积 chunk 直到 end 事件再解析，或者直接使用框架提供的 body 解析。这是自己手写 HTTP 服务时最容易踩的坑之一。',
    difficulty: 'beginner',
  },
  {
    id: 'foundation-q4',
    stage: 'foundation',
    prompt: '要查出「每个用户最近一次登录时间」，下面哪个写法是对的？',
    options: [
      'SELECT user_id, logged_at FROM logins ORDER BY logged_at DESC',
      'SELECT user_id, MAX(logged_at) FROM logins GROUP BY user_id',
      'SELECT MAX(logged_at) FROM logins WHERE user_id = user_id',
      'SELECT user_id, logged_at FROM logins LIMIT 1',
    ],
    answerIndex: 1,
    explanation:
      'GROUP BY user_id 之后对每组的 logged_at 取 MAX，就得到每个用户的最近登录时间。另外注意：SELECT 里不能出现既没被聚合、也不在 GROUP BY 中的列，否则结果是不确定的。',
    difficulty: 'beginner',
  },
  {
    id: 'foundation-q5',
    stage: 'foundation',
    prompt: '什么情况下数据库索引反而会拖慢系统？',
    options: [
      '表里的数据少于 1000 行时',
      '在写入非常频繁的表上建了过多索引时',
      '索引列允许为 NULL 时',
      '索引名字起得太长时',
    ],
    answerIndex: 1,
    explanation:
      '每次 INSERT / UPDATE / DELETE 都要同步维护相关索引。读多写少的表多建索引很划算，但写密集的表每多一个索引就多一份写入开销和存储占用。索引不是越多越好。',
    difficulty: 'intermediate',
  },
  {
    id: 'foundation-q6',
    stage: 'foundation',
    prompt: '`git rebase` 和 `git merge` 的核心区别是什么？',
    options: [
      'rebase 会改写提交历史，merge 会保留分支分叉并生成一个合并提交',
      'rebase 只能用在本地分支上，merge 只能用在远程分支上',
      'merge 会丢失提交信息，rebase 不会',
      '没有实质区别，只是团队偏好',
    ],
    answerIndex: 0,
    explanation:
      'merge 保留真实的分支分叉，额外产生一个合并提交；rebase 把你的提交搬到新基线上重放，历史是干净的直线，但提交 hash 会变。因此有一条铁律：不要 rebase 已经推送到共享分支的提交，否则会打乱别人的历史。',
    difficulty: 'intermediate',
  },

  // ============ 阶段 2：LLM 应用核心 ============
  {
    id: 'llm-core-q1',
    stage: 'llm-core',
    prompt: '为什么调用 LLM API 时，超时和重试必须一起设置？',
    options: [
      '为了节省 token 费用',
      'LLM 推理耗时长且上游会偶发抖动：没有超时会挂住整条请求链路，没有重试则偶发错误直接变成用户可见的失败',
      '因为大多数 LLM SDK 强制要求这两个参数',
      '为了绕过接口的速率限制',
    ],
    answerIndex: 1,
    explanation:
      'LLM 调用通常几秒到几十秒，上游限流和过载是常态。超时防止一个慢请求占满连接；重试（配指数退避）把偶发的 429/503 吸收掉。只设其一都不完整。',
    difficulty: 'beginner',
  },
  {
    id: 'llm-core-q2',
    stage: 'llm-core',
    prompt: '要让模型稳定返回可用的 JSON，最可靠的做法是？',
    options: [
      '在 prompt 里反复强调「请务必只返回 JSON」',
      '用结构化输出 / JSON Schema 强约束格式，并在应用侧再校验一次，不合格就带错误重试',
      '用正则表达式从回复里把 JSON 抠出来',
      '改成让模型返回 XML，XML 更好解析',
    ],
    answerIndex: 1,
    explanation:
      'prompt 里的嘱咐只是软约束，模型仍可能加解释文字或漏字段。生产做法是双重保险：API 层用 JSON Schema 或 tool calling 约束输出格式，应用层再用校验器验一遍（比如 zod），不合格就把错误信息回传重试一次。',
    difficulty: 'intermediate',
  },
  {
    id: 'llm-core-q3',
    stage: 'llm-core',
    prompt: '把 temperature 设为 0，输出就完全确定了吗？',
    options: [
      '是的，0 就是贪心解码，结果必然可复现',
      '不是，GPU 浮点运算顺序、批处理调度、模型版本更新都可能让同一输入产生不同输出',
      '是的，只要不使用流式输出',
      '只有部分厂商的模型能做到确定',
    ],
    answerIndex: 1,
    explanation:
      'temperature=0 是贪心解码，能大幅降低随机性，但无法保证逐字节可复现：浮点归约顺序、并发批处理、以及服务端悄悄升级模型版本都会引入差异。所以评测要跑多次看统计，而不是断言某一次的字面输出。',
    difficulty: 'advanced',
  },
  {
    id: 'llm-core-q4',
    stage: 'llm-core',
    prompt: 'Function calling 中，模型返回了工具名和参数，这个工具该由谁执行？',
    options: [
      '模型自己会在沙箱里执行',
      '你的应用程序执行，然后把结果作为一条消息回传给模型',
      '由 API 提供方代为执行',
      '不需要执行，直接把参数展示给用户即可',
    ],
    answerIndex: 1,
    explanation:
      '模型只负责「决定调用什么」，真正执行的是你的代码——这也正是安全边界所在：工具能做什么、参数是否越权、要不要二次确认，全部必须在你这侧把关。执行完把结果以 tool 角色消息回传，模型才能基于真实结果继续推理。',
    difficulty: 'intermediate',
  },
  {
    id: 'llm-core-q5',
    stage: 'llm-core',
    prompt: '流式输出（SSE）对用户体验最大的价值是什么？',
    options: [
      '显著降低 token 成本',
      '大幅提前首个 token 出现的时间，用户不用干等完整响应',
      '提高回答的准确率',
      '减少带宽占用',
    ],
    answerIndex: 1,
    explanation:
      '流式不改变总耗时，也不省钱（token 一样多），它改善的是「感知延迟」——用户几百毫秒就看到内容开始涌现，而不是盯 20 秒转圈。代价是错误处理变复杂：如果中途出错，你已经吐出去一部分内容了。',
    difficulty: 'beginner',
  },
  {
    id: 'llm-core-q6',
    stage: 'llm-core',
    prompt: '上下文窗口快满时，下面哪种处理方式最不可取？',
    options: [
      '对早期对话做摘要压缩后替换原文',
      '只保留最近 N 轮对话加系统提示',
      '直接静默截断最早的那几条消息',
      '把长文档改为向量检索、按需注入相关片段',
    ],
    answerIndex: 2,
    explanation:
      '静默截断最危险：你不知道丢掉的恰好是不是关键约束，而且系统提示一旦被截掉，模型行为会突然变化，问题还很难复现。可接受的方案是「有损但可控」——摘要、滑动窗口、按需检索，并且你对丢了什么有明确预期。',
    difficulty: 'advanced',
  },

  // ============ 阶段 3：检索增强生成 ============
  {
    id: 'rag-q1',
    stage: 'rag',
    prompt: '固定长度切分（比如每 500 字一刀）最典型的失败场景是？',
    options: [
      '切分速度太慢，拖累索引构建',
      '把一句话或一段完整论证从中间切断，检索出来的片段语义不完整',
      '无法处理中文文本',
      '会导致 embedding 向量维度不一致',
    ],
    answerIndex: 1,
    explanation:
      '按字符数硬切不理解语义边界，很容易在句子中间断开，导致召回的片段缺少主语或结论。常见改进是按结构切（标题、段落、代码块）并让相邻块保留重叠（overlap），维持上下文连续性。',
    difficulty: 'intermediate',
  },
  {
    id: 'rag-q2',
    stage: 'rag',
    prompt: 'RAG 回答质量差，应该优先排查哪一环？',
    options: [
      '先换一个更大的模型试试',
      '先看检索结果里到底有没有正确答案——召回率是 RAG 的第一瓶颈',
      '先把 temperature 调低',
      '先把 system prompt 写得更长更详细',
    ],
    answerIndex: 1,
    explanation:
      'RAG 的瓶颈绝大多数在检索。如果正确片段根本没被召回，再强的模型也变不出来。先人工检查「标准答案所在的片段排在第几位」，用 recall@k 定位问题，再考虑重排、混合检索、切分策略。',
    difficulty: 'intermediate',
  },
  {
    id: 'rag-q3',
    stage: 'rag',
    prompt: '向量检索相比 BM25 这类关键词检索，最大的短板是什么？',
    options: [
      '检索速度明显更慢',
      '对精确匹配不敏感：人名、型号、错误码、专有名词容易失手',
      '完全无法处理中文',
      '必须依赖 GPU 才能运行',
    ],
    answerIndex: 1,
    explanation:
      '向量检索擅长语义相近，但对 ERR_4032 这类精确字符串容易召回一堆「语义相近但编号不同」的内容。所以生产环境常用混合检索：BM25 保精确、向量保语义，再用 RRF 或重排模型融合两路结果。',
    difficulty: 'advanced',
  },
  {
    id: 'rag-q4',
    stage: 'rag',
    prompt: '重排（rerank）模型应该放在 RAG 流程的哪一步？',
    options: [
      '在文档切分之前',
      '在向量检索召回候选之后、拼进 prompt 之前',
      '在模型生成答案之后',
      '在生成 embedding 之前',
    ],
    answerIndex: 1,
    explanation:
      '典型的两段式检索：先用便宜的向量检索快速召回几十条候选，再用 cross-encoder 重排模型对「问题-片段」逐对精细打分，取 top 3–5 拼进 prompt。重排精度高但计算贵，所以只用在小候选集上。',
    difficulty: 'intermediate',
  },
  {
    id: 'rag-q5',
    stage: 'rag',
    prompt: '为什么 RAG 项目必须建一套评测集？',
    options: [
      '为了提高代码测试覆盖率',
      '否则每次调整切分策略、模型或参数都只能凭感觉，无法判断是真变好还是错觉',
      '因为主流 RAG 框架要求提供评测集',
      '为了减少 token 消耗',
    ],
    answerIndex: 1,
    explanation:
      'RAG 有太多可调旋钮（切分大小、top-k、embedding 模型、是否重排），凭感觉调参必然陷入「这次好像好一点」的自我欺骗。准备 30–50 条「问题 → 标准答案或标准片段」，每次改动跑一遍看指标变化，才谈得上技术决策。',
    difficulty: 'intermediate',
  },
  {
    id: 'rag-q6',
    stage: 'rag',
    prompt: '下面哪种需求最适合用 RAG 而不是微调来解决？',
    options: [
      '让模型学会一种全新的输出风格',
      '知识频繁更新，且回答需要给出引用出处',
      '大幅降低单次推理成本',
      '让模型掌握一门新的编程语言',
    ],
    answerIndex: 1,
    explanation:
      'RAG 的核心优势是知识外置：更新知识只需更新文档库，不用重训，而且天然能附上引用来源。微调更适合固化风格、格式或行为模式。一句话概括：要让模型「知道事实」用 RAG，要让它「学会怎么做」才考虑微调。',
    difficulty: 'intermediate',
  },

  // ============ 阶段 4：智能体与工具调用 ============
  {
    id: 'agent-q1',
    stage: 'agent',
    prompt: '工具调用循环里，最必须设置的保护措施是什么？',
    options: [
      '最大步数上限加上整体超时',
      '把 temperature 固定为 0',
      '每次调用工具前重新加载一遍系统提示',
      '禁用流式输出以避免并发问题',
    ],
    answerIndex: 0,
    explanation:
      '智能体最典型的线上事故就是死循环——模型反复调用同一个工具，或两个工具互相触发，token 成本瞬间失控。必须给循环设硬上限（最大步数）和整体超时，触顶时优雅返回「已尽力，当前进展是……」，而不是无限跑下去。',
    difficulty: 'beginner',
  },
  {
    id: 'agent-q2',
    stage: 'agent',
    prompt: 'ReAct 范式的核心循环是哪三步？',
    options: [
      '训练 → 推理 → 评估',
      '思考（Reason）→ 行动（Act）→ 观察（Observe）',
      '提问 → 回答 → 追问',
      '切分 → 检索 → 生成',
    ],
    answerIndex: 1,
    explanation:
      'ReAct = Reasoning + Acting。模型先产出思考（下一步该做什么），再决定调用哪个工具，拿到观察结果后进入下一轮。关键在于「观察」这一步把真实世界的反馈重新注入上下文，模型才有机会纠偏。',
    difficulty: 'beginner',
  },
  {
    id: 'agent-q3',
    stage: 'agent',
    prompt: '工具执行报错时，最恰当的处理方式是？',
    options: [
      '把异常堆栈直接抛给用户看',
      '把错误信息作为工具结果回传给模型，让它决定重试或换方案，同时限制重试次数',
      '静默忽略错误，返回一个空结果',
      '立刻终止整个会话并清空上下文',
    ],
    answerIndex: 1,
    explanation:
      '错误信息对模型是极有价值的信号：提示「参数格式不对」它会改参数，提示「查无此人」它会换关键词。静默返回空结果最糟——模型会以为「确实没有数据」，进而给出错误结论。但要防住它无限重试同一个失败调用，所以必须有重试上限。',
    difficulty: 'intermediate',
  },
  {
    id: 'agent-q4',
    stage: 'agent',
    prompt: '智能体的「记忆」为什么要区分短期和长期？',
    options: [
      '因为短期记忆不产生费用',
      '因为上下文窗口有限，把所有历史都塞进去会又贵又慢，还会稀释关键信息',
      '因为长期记忆的检索准确率更高',
      '因为 API 设计上要求分开存储',
    ],
    answerIndex: 1,
    explanation:
      '上下文窗口是硬约束。把全部历史塞进去，成本线性增长，关键指令还会被大量无关内容淹没。常见做法是短期记忆保留最近几轮原文，长期记忆把重要事实抽取后存进外部存储（向量库或结构化表），需要时按相关性检索回来。',
    difficulty: 'intermediate',
  },
  {
    id: 'agent-q5',
    stage: 'agent',
    prompt: '让智能体「先规划再多步执行」，相比「一步一调用」的主要好处是？',
    options: [
      '总是能减少 token 消耗',
      '能处理后一步依赖前一步结果的任务，并且拿到中间结果后可以调整计划',
      '能保证输出准确率更高',
      '可以不再需要工具调用',
    ],
    answerIndex: 1,
    explanation:
      '有些任务天然是多步且强依赖的（先查订单、再算可退金额、再发起退款）。先产出计划再执行，可以在拿到中间结果后重新规划，而不是一条道走到黑。代价是规划与实际执行可能不一致，所以每一步仍需校验。',
    difficulty: 'intermediate',
  },
  {
    id: 'agent-q6',
    stage: 'agent',
    prompt: '多智能体（multi-agent）方案相比单智能体，最主要的代价是什么？',
    options: [
      '无法使用工具调用',
      '通信开销与错误传播：信息在智能体之间传递时会失真，出问题也很难定位',
      '无法调用 LLM，只能用规则',
      '只能处理很简单的任务',
    ],
    answerIndex: 1,
    explanation:
      '多智能体把一个大上下文拆成几个小上下文，确实能缓解上下文压力，但每一次「交接」都是一次有损压缩，错误会在链路中放大，而且排查时很难判断是哪一环出的问题。建议先穷尽「单智能体 + 更好的工具设计」，再考虑拆分。',
    difficulty: 'advanced',
  },

  // ============ 阶段 5：工程化与生产 ============
  {
    id: 'engineering-q1',
    stage: 'engineering',
    prompt: '为什么 LLM 功能的测试不能只靠断言「输出等于某个固定字符串」？',
    options: [
      '因为字符串比较的性能太差',
      '因为模型输出是非确定性的，同一输入可能产生措辞不同但等价的答案',
      '因为测试框架不支持异步断言',
      '因为 API 不允许录制响应做回放',
    ],
    answerIndex: 1,
    explanation:
      'LLM 输出是一个分布而不是定值，逐字比较的测试会随机变红。可行做法是断言「结构与语义」：校验结构化输出是否满足 schema、关键字段是否抽对、分类结果是否命中标签，再配合 LLM-as-judge 或人工标注的评测集做统计打分。',
    difficulty: 'intermediate',
  },
  {
    id: 'engineering-q2',
    stage: 'engineering',
    prompt: '生产环境记录 LLM 调用日志时，最应该记录哪些信息？',
    options: [
      '只记录最终回答内容就够了',
      '请求参数、模型与版本、token 数、耗时、成本，以及脱敏后的完整 prompt 与响应',
      '只记录出错的请求',
      '只需要记录耗时，用于性能分析',
    ],
    answerIndex: 1,
    explanation:
      '「这次回答为什么慢 / 贵 / 错」这类问题只能靠链路数据回答。你需要能按 trace 关联到具体 prompt、模型版本、token 数和延迟。同时用户隐私数据必须脱敏或哈希——这既是合规要求，也是避免日志本身变成新的泄露源。',
    difficulty: 'intermediate',
  },
  {
    id: 'engineering-q3',
    stage: 'engineering',
    prompt: '提示注入（prompt injection）为什么不能只靠「在系统提示里声明禁止」来解决？',
    options: [
      '因为系统提示在多数模型里优先级最低',
      '因为注入内容与正常指令在模型眼里都是同质的文本，模型没有可靠机制区分二者的信任级别',
      '因为系统提示有长度上限，写不下完整规则',
      '因为只有部分厂商的模型会被注入',
    ],
    answerIndex: 1,
    explanation:
      '对模型来说，「忽略之前的指令」和「请总结这篇文章」都只是 token 序列，没有天然的信任边界。所以防御必须落在模型之外：最小权限原则（工具只给必要权限）、对模型产出的动作做校验与确认、敏感操作要求人工二次确认、并把外部内容显式标注为不可信数据。',
    difficulty: 'advanced',
  },
  {
    id: 'engineering-q4',
    stage: 'engineering',
    prompt: '给 LLM 服务做缓存时，哪种做法最危险？',
    options: [
      '对完全相同的请求缓存结果',
      '对语义相似的请求做缓存，但缓存键里没有用户 / 租户维度',
      '缓存 embedding 计算结果',
      '缓存模型列表这类元数据',
    ],
    answerIndex: 1,
    explanation:
      '语义缓存把「相似」当成「相同」。一旦跨用户命中，就会把 A 用户的数据返回给 B 用户——这是数据泄露事故，不是性能优化。任何缓存键都必须包含租户 / 用户维度，这个疏忽在演示环境看不出来，上线就是事故。',
    difficulty: 'advanced',
  },
  {
    id: 'engineering-q5',
    stage: 'engineering',
    prompt: '模型服务不可用时，下面哪一项**不属于**合理的降级策略？',
    options: [
      '切换到备用模型或备用供应商',
      '返回缓存中的近似结果，并明确标注这是缓存内容',
      '降级到基于规则的确定性逻辑',
      '不加限制地重试，直到成功为止',
    ],
    answerIndex: 3,
    explanation:
      '无限重试会把上游的一次抖动放大成雪崩，还会烧光重试预算和配额。正确姿势是有限重试 + 指数退避 + 熔断，然后走降级路径，并把降级状态如实暴露给用户（「当前为缓存结果」），而不是假装一切正常。',
    difficulty: 'intermediate',
  },
  {
    id: 'engineering-q6',
    stage: 'engineering',
    prompt: '想判断一次 prompt 改动到底是变好还是变差，最可靠的做法是？',
    options: [
      '自己读几条输出，凭感觉判断',
      '在固定评测集上跑两版，对比通过率或评分，并考虑样本量是否足够',
      '直接问模型自己「这版是不是更好」',
      '比较响应长度，变长了说明更详细',
    ],
    answerIndex: 1,
    explanation:
      '人工看几条样本极易被个案带偏——你恰好看到了一条变好的，就以为整体变好了。正确做法是固定评测集、固定参数跑两版再比较指标。样本量小的时候还要注意：差异可能落在噪声区间内，别把抖动当成改进。',
    difficulty: 'intermediate',
  },

  // ============ 阶段 6：综合项目实战 ============
  {
    id: 'capstone-q1',
    stage: 'capstone',
    prompt: '毕业项目的 README 里，哪一项最能体现你的工程判断力？',
    options: [
      '精美的项目截图',
      '技术选型与取舍说明：为什么这么选、还考虑过什么、代价是什么',
      '完整的依赖包列表',
      '代码行数统计',
    ],
    answerIndex: 1,
    explanation:
      '截图和依赖列表谁都能贴。评审者真正想看的是决策过程——面对同样的约束，你为什么选了 A 而不是 B，以及你清楚这个选择换来了什么、放弃了什么。这才是「工程师」和「会调 API 的人」的分界线。',
    difficulty: 'intermediate',
  },
  {
    id: 'capstone-q2',
    stage: 'capstone',
    prompt: '项目里同时要做 RAG 和 Agent，更合理的推进顺序是？',
    options: [
      '两条线同时推进，节省时间',
      '先把 RAG 的检索质量做扎实并建立评测，再让 Agent 去调用它',
      '先做 Agent，RAG 后面再补',
      '都先放一放，先把界面做出来',
    ],
    answerIndex: 1,
    explanation:
      'Agent 建立在工具之上。如果底层工具（检索）本身不可靠，Agent 只会在错误的基础上反复试错，而调试时你分不清是「规划错了」还是「检索错了」。先把每个工具单独做到可评测、可信赖，再让 Agent 组合它们。',
    difficulty: 'advanced',
  },
  {
    id: 'capstone-q3',
    stage: 'capstone',
    prompt: '对于「作品集项目要不要用最新最热的框架」，更合理的判断是？',
    options: [
      '一定要用最新的，显得跟得上技术潮流',
      '用你最能在面试里讲清楚原理的那套，因为考的是理解深度而不是 API 记忆',
      '只用最老最稳的，避免踩坑',
      '框架无所谓，随便选一个都行',
    ],
    answerIndex: 1,
    explanation:
      '面试官会追着问「这个框架内部是怎么实现的」「为什么这样设计」。用一个你只调过 API 的热门框架，被追问两层就露怯了；用一套你能讲清原理的技术栈，即使不新，也能展现真实的工程能力。',
    difficulty: 'intermediate',
  },
  {
    id: 'capstone-q4',
    stage: 'capstone',
    prompt: '项目已经有评测数据、部署地址和 README，还缺哪一项才最接近「可交付」？',
    options: [
      '更多的功能点',
      '可复现的运行方式：一条命令跑起来、环境变量说明、数据库初始化步骤',
      '更精致的界面设计',
      '更多的 GitHub star',
    ],
    answerIndex: 1,
    explanation:
      '「能交付」的核心标准是别人能跑起来。缺了环境变量说明和初始化步骤，评审者卡在第一步，后面做得再好也看不到。这一项最容易被自己忽略，却最影响别人对你的评价。',
    difficulty: 'beginner',
  },
  {
    id: 'capstone-q5',
    stage: 'capstone',
    prompt: '项目做完后，最有价值的复盘动作是什么？',
    options: [
      '统计代码行数和提交次数',
      '记录踩过的坑：当时怎么定位的、根因是什么、如果重做会怎么改',
      '赶紧开始写下一个新项目',
      '把注释补充完整',
    ],
    answerIndex: 1,
    explanation:
      '面试和实际工作中，「你怎么排查问题」比「你写了什么功能」更能体现能力。把调试过程写成复盘（现象 → 假设 → 验证 → 结论），既固化了经验，也是面试时最有说服力的素材。',
    difficulty: 'beginner',
  },
  {
    id: 'capstone-q6',
    stage: 'capstone',
    prompt: '如果只能给这个毕业项目再加一个「生产级」特性，最该加的是？',
    options: [
      '用户头像上传',
      '调用链路追踪加上成本监控',
      '深色模式',
      '多语言支持',
    ],
    answerIndex: 1,
    explanation:
      '「生产级」的分水岭是「出问题时你能不能知道」。链路追踪让你定位到具体哪一步慢或错，成本监控让你知道每次请求花了多少钱——这两件事直接决定服务能不能长期活下去。界面细节属于锦上添花。',
    difficulty: 'beginner',
  },
];
