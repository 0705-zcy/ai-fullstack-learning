/**
 * 端到端冒烟测试：用真实 HTTP 请求走一遍完整学习流程。
 *
 * 不是单元测试的替代品，而是验证「构建产物真的能跑起来」——
 * 单测跑的是内存数据库和 app.request()，这里跑的是真实进程、真实端口、真实 SQLite 文件。
 *
 * 用法：node scripts/smoke.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? 'http://localhost:8791';

let cookie = '';
let passed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  OK   ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function call(path, init = {}) {
  const headers = { ...(init.headers ?? {}) };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

console.log(`\n冒烟测试目标：${BASE}\n`);

// ---- 1. 健康检查 ----
console.log('[1] 服务可用性');
{
  const health = await call('/api/health');
  check('GET /api/health 返回 200', health.status === 200, `实际 ${health.status}`);
}

// ---- 2. 未登录时的鉴权 ----
console.log('\n[2] 未登录鉴权');
{
  const dashboard = await call('/api/dashboard');
  check('未登录访问仪表盘返回 401', dashboard.status === 401, `实际 ${dashboard.status}`);

  const progress = await call('/api/progress');
  check('未登录访问进度返回 401', progress.status === 401, `实际 ${progress.status}`);
}

// ---- 3. 公开的资源库 ----
console.log('\n[3] 资源库');
let firstResourceId = null;
{
  const all = await call('/api/resources');
  check('资源列表返回 200', all.status === 200, `实际 ${all.status}`);
  check('资源数量 >= 40', (all.json?.total ?? 0) >= 40, `实际 ${all.json?.total}`);
  check('facets 覆盖 6 个阶段', all.json?.facets?.stages?.length === 6);
  check(
    '每个阶段都至少有 2 个资源',
    all.json?.facets?.stages?.every((s) => s.count >= 2),
    JSON.stringify(all.json?.facets?.stages?.map((s) => `${s.id}:${s.count}`)),
  );
  check(
    '每个阶段都至少有 2 门完整体系课（「能完整学会」的底线）',
    all.json?.facets?.stages?.every((s) => s.curriculumCount >= 2),
    JSON.stringify(all.json?.facets?.stages?.map((s) => `${s.id}:${s.curriculumCount}`)),
  );
  check(
    '中英文资源都有',
    all.json?.facets?.languages?.some((l) => l.value === 'zh') &&
      all.json?.facets?.languages?.some((l) => l.value === 'en'),
    JSON.stringify(all.json?.facets?.languages),
  );
  check(
    '所有资源链接都是 https',
    all.json?.items?.every((r) => r.url.startsWith('https://')),
  );
  check(
    '每条资源都有合法的 scope',
    all.json?.items?.every((r) => r.scope === 'curriculum' || r.scope === 'supplement'),
  );

  firstResourceId = all.json?.items?.[0]?.id ?? null;

  const curriculumOnly = await call('/api/resources?scope=curriculum');
  check(
    '只看完整体系课：筛选生效且数量可观',
    curriculumOnly.json?.items?.every((r) => r.scope === 'curriculum') &&
      curriculumOnly.json.total >= 18,
    `实际 ${curriculumOnly.json?.total} 条`,
  );

  const supplementOnly = await call('/api/resources?scope=supplement');
  check(
    '两类资源加起来是全集，没有遗漏',
    (curriculumOnly.json?.total ?? 0) + (supplementOnly.json?.total ?? 0) === all.json?.total,
  );

  const defaultOrder = await call('/api/resources?stage=foundation');
  check(
    '默认排序把体系课排在同一阶段前面',
    defaultOrder.json?.items?.[0]?.scope === 'curriculum',
    `首条是 ${defaultOrder.json?.items?.[0]?.scope}`,
  );

  const ragOnly = await call('/api/resources?stage=rag');
  check(
    '按阶段筛选只返回该阶段',
    ragOnly.json?.items?.every((r) => r.stage === 'rag') && ragOnly.json.total > 0,
  );

  const zhOnly = await call('/api/resources?language=zh&maxHours=10');
  check(
    '组合筛选（中文 + 10 小时内）生效',
    zhOnly.json?.items?.every((r) => r.language === 'zh' && r.durationHours <= 10),
  );

  const badQuery = await call('/api/resources?stage=not-a-stage');
  check('非法筛选值返回 400', badQuery.status === 400, `实际 ${badQuery.status}`);
}

// ---- 4. 学习路径 ----
console.log('\n[4] 学习路径');
{
  const stages = await call('/api/stages');
  check('阶段列表返回 6 个阶段', stages.json?.stages?.length === 6);

  const rag = await call('/api/stages/rag');
  check('阶段详情返回资源与题量', (rag.json?.resources?.length ?? 0) >= 2 && rag.json?.quizTotal >= 5);

  const nope = await call('/api/stages/nope');
  check('未知阶段返回 404', nope.status === 404, `实际 ${nope.status}`);
}

// ---- 5. 注册 ----
console.log('\n[5] 注册与登录');
const email = `smoke-${Date.now()}@example.com`;
{
  const weak = await call('/api/auth/register', {
    method: 'POST',
    body: { email, password: '123' },
  });
  check('弱密码被拒绝（400）', weak.status === 400, `实际 ${weak.status}`);

  const register = await call('/api/auth/register', {
    method: 'POST',
    body: { email, password: 'smoke-password-123', displayName: '冒烟测试' },
  });
  check('注册成功返回 201', register.status === 201, `实际 ${register.status}`);
  check('返回了会话 cookie', cookie.startsWith('aifs_session='), cookie.slice(0, 20));
  check('响应不含密码哈希', !register.text.includes('scrypt'));

  const me = await call('/api/auth/me');
  check('带 cookie 可获取当前用户', me.json?.user?.email === email);

  const dup = await call('/api/auth/register', {
    method: 'POST',
    body: { email, password: 'smoke-password-123' },
  });
  check('重复注册返回 409', dup.status === 409, `实际 ${dup.status}`);
}

// ---- 6. 自测（重点：不能泄露答案） ----
console.log('\n[6] 自测');
{
  const quiz = await call('/api/quiz/rag');
  check('取题返回 200', quiz.status === 200, `实际 ${quiz.status}`);
  check('题量 >= 5', (quiz.json?.questions?.length ?? 0) >= 5);
  check(
    '题目响应不含 answerIndex / explanation',
    !quiz.text.includes('answerIndex') && !quiz.text.includes('explanation'),
  );

  // 全部答对
  const bank = await call('/api/quiz/rag');
  const questions = bank.json.questions;

  // 从服务端拿不到答案，这里用「每个选项都试一遍」的方式不现实，
  // 所以直接构造全选 0 的提交，验证接口能正常判分即可
  const answers = questions.map((q) => ({ questionId: q.id, optionIndex: 0 }));
  const submit = await call('/api/quiz/rag/submit', {
    method: 'POST',
    body: { stage: 'rag', answers },
  });

  check('交卷返回 200', submit.status === 200, `实际 ${submit.status}`);
  check('返回逐题解析', submit.json?.results?.length === questions.length);
  check(
    '每题都有正确答案下标与解析',
    submit.json?.results?.every(
      (r) => Number.isInteger(r.correctIndex) && r.explanation.length > 0,
    ),
  );
  check('bankTotal 等于题库总数', submit.json?.bankTotal === questions.length);
  check('score 在合法区间', submit.json?.score >= 0 && submit.json?.score <= questions.length);

  const mismatched = await call('/api/quiz/rag/submit', {
    method: 'POST',
    body: { stage: 'agent', answers },
  });
  check('stage 不一致返回 400', mismatched.status === 400, `实际 ${mismatched.status}`);
}

// ---- 7. 进度与仪表盘 ----
console.log('\n[7] 进度与仪表盘');
{
  const before = await call('/api/dashboard');
  check('新用户总资源数 >= 40', (before.json?.overall?.totalResources ?? 0) >= 40);
  check('新用户完成度为 0', before.json?.overall?.completion === 0);
  check('新用户当前阶段是 foundation', before.json?.currentStage === 'foundation');
  check('只有第一个阶段解锁', before.json?.stages?.[0]?.unlocked === true && before.json?.stages?.[1]?.unlocked === false);
  check('推荐了「继续学习」的资源', Boolean(before.json?.continueLearning?.id));

  const set = await call('/api/progress', {
    method: 'PUT',
    body: { resourceId: firstResourceId, status: 'completed' },
  });
  check('设置进度返回 200', set.status === 200, `实际 ${set.status}`);

  const badResource = await call('/api/progress', {
    method: 'PUT',
    body: { resourceId: 'ghost-resource', status: 'completed' },
  });
  check('不存在的资源返回 404', badResource.status === 404, `实际 ${badResource.status}`);

  const entries = await call('/api/progress');
  check('进度已持久化', entries.json?.entries?.length === 1);

  const after = await call('/api/dashboard');
  check('仪表盘反映已完成资源', after.json?.overall?.completedResources === 1);
  check(
    '累计投入时长大于 0',
    (after.json?.overall?.estimatedHoursSpent ?? 0) > 0,
    String(after.json?.overall?.estimatedHoursSpent),
  );

  const removed = await call(`/api/progress/${firstResourceId}`, { method: 'DELETE' });
  check('删除进度返回 200', removed.status === 200, `实际 ${removed.status}`);

  const cleared = await call('/api/progress');
  check('删除后进度清空', cleared.json?.entries?.length === 0);
}

// ---- 8. 登出 ----
console.log('\n[8] 登出');
{
  const logout = await call('/api/auth/logout', { method: 'POST' });
  check('登出返回 200', logout.status === 200, `实际 ${logout.status}`);

  // 登出后 cookie 已被服务端清除，但客户端仍持有旧值；
  // 这里重新用空 cookie 验证接口确实拒绝
  cookie = '';
  const me = await call('/api/auth/me');
  check('清空 cookie 后 /me 返回 401', me.status === 401, `实际 ${me.status}`);
}

console.log(`\n${'='.repeat(50)}`);
if (failures.length === 0) {
  console.log(`冒烟测试全部通过：${passed} 项`);
  process.exit(0);
} else {
  console.log(`冒烟测试失败 ${failures.length} 项（通过 ${passed} 项）：`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
