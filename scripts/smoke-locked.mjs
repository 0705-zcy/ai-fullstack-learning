/**
 * 「只有我自己用」配置的端到端冒烟测试。
 *
 * 验证 AIFS_REGISTRATION=closed 时：
 *   1. 空库仍能创建第一个账号（引导例外，否则新部署会直接锁死）
 *   2. 有了账号之后，任何新注册都被拒绝
 *   3. 已有账号仍能正常登录
 *   4. 前端能拿到策略，从而隐藏注册入口
 *
 * 用法：
 *   AIFS_REGISTRATION=closed node apps/api/dist/index.js   # 另开一个终端
 *   node scripts/smoke-locked.mjs http://localhost:8792
 */
const BASE = process.argv[2] ?? 'http://localhost:8792';
const PASSWORD = 'smoke-password-123';

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

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  const setCookie = res.headers.get('set-cookie');
  return { status: res.status, json, text, cookie: setCookie ? setCookie.split(';')[0] : '' };
}

console.log(`\n关闭注册模式的冒烟测试：${BASE}\n`);

// ---- 1. 策略 ----
console.log('[1] 认证策略');
{
  const policy = await call('/api/auth/policy');
  check('策略接口可访问', policy.status === 200, `实际 ${policy.status}`);
  check('mode 为 closed', policy.json?.mode === 'closed', `实际 ${policy.json?.mode}`);
  check('registrationEnabled 为 false', policy.json?.registrationEnabled === false);
}

// ---- 2. 引导例外 ----
console.log('\n[2] 引导例外（空库的第一个账号）');
const owner = `owner-${Date.now()}@example.com`;
{
  const res = await call('/api/auth/register', {
    method: 'POST',
    body: { email: owner, password: PASSWORD, displayName: '拥有者' },
  });

  check('空库时第一个注册被放行', res.status === 201, `实际 ${res.status}`);
  check('拿到了会话 cookie', res.cookie.startsWith('aifs_session='));
}

// ---- 3. 关闭生效 ----
console.log('\n[3] 关闭注册已生效');
{
  const res = await call('/api/auth/register', {
    method: 'POST',
    body: { email: `stranger-${Date.now()}@example.com`, password: PASSWORD },
  });

  check('陌生人注册被拒绝（403）', res.status === 403, `实际 ${res.status}`);
  check('拒绝原因可读', /关闭注册/.test(res.json?.error?.message ?? ''), res.json?.error?.message);

  const sameEmail = await call('/api/auth/register', {
    method: 'POST',
    body: { email: owner, password: PASSWORD },
  });
  check(
    '用已存在邮箱注册也返回 403（不泄漏邮箱是否已注册）',
    sameEmail.status === 403,
    `实际 ${sameEmail.status}`,
  );
}

// ---- 4. 已有账号仍可用 ----
console.log('\n[4] 已有账号不受影响');
{
  const login = await call('/api/auth/login', {
    method: 'POST',
    body: { email: owner, password: PASSWORD },
  });
  check('已有账号能正常登录', login.status === 200, `实际 ${login.status}`);

  const me = await call('/api/auth/me', { headers: { cookie: login.cookie } });
  check('登录后能取到自己的信息', me.json?.user?.email === owner);

  const dashboard = await call('/api/dashboard', { headers: { cookie: login.cookie } });
  check('登录后能拿到仪表盘', dashboard.status === 200, `实际 ${dashboard.status}`);

  const resources = await call('/api/resources');
  check('资源库照常可访问', resources.status === 200 && resources.json?.total > 0);
}

console.log(`\n${'='.repeat(52)}`);
if (failures.length === 0) {
  console.log(`关闭注册模式验证通过：${passed} 项`);
  process.exit(0);
} else {
  console.log(`失败 ${failures.length} 项（通过 ${passed} 项）：`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
