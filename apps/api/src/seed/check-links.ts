import { RESOURCES } from './resources.js';

/**
 * 死链巡检：把所有课程链接实际请求一遍，报告不可用的。
 *
 * 为什么值得单独写一个脚本：资源库的全部价值就是那些外链，
 * 一条 404 就等于一个用户白点一次。课程站点改版、仓库迁移、免费页下线
 * 都会让链接悄悄失效——靠人工点是不现实的。
 *
 * 用法：npm run check:links
 * 退出码：有失效链接时为 1，方便挂到 CI 或定时任务上。
 */

const TIMEOUT_MS = 20_000;
const CONCURRENCY = 6;
/** 有些站点会拦截脚本请求，这些状态码不代表链接真的坏了。 */
const SOFT_FAIL = new Set([401, 403, 405, 406, 429, 501, 503]);
/**
 * TLS 证书链验证失败的错误码。
 *
 * 出现在公司网络或带 TLS 拦截代理的环境里：操作系统信任代理的根证书，
 * 但 Node 用的是自带的 CA 库，于是握手失败。
 * 这**不代表链接失效**，重跑时加 `--use-system-ca`（Node 24+）即可，
 * 或者设 NODE_EXTRA_CA_CERTS 指向公司根证书。
 */
const TLS_ERRORS = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_SIGNATURE_FAILURE',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
]);

type Verdict = 'ok' | 'soft' | 'tls' | 'dead';

interface Result {
  id: string;
  url: string;
  status: number | string;
  verdict: Verdict;
}

function errorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null) return '';
  const cause = (error as { cause?: unknown }).cause;
  if (typeof cause === 'object' && cause !== null && 'code' in cause) {
    return String((cause as { code: unknown }).code);
  }
  return '';
}

async function fetchWithTimeout(url: string, method: 'HEAD' | 'GET'): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        // 有些站点对没有 UA 的请求直接 403
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function checkOne(id: string, url: string): Promise<Result> {
  try {
    let response = await fetchWithTimeout(url, 'HEAD');

    // 不少站点不支持 HEAD（405/501），或对 HEAD 更严格（403）——换成 GET 再试一次
    if (response.status >= 400) {
      response = await fetchWithTimeout(url, 'GET');
    }

    if (response.status >= 200 && response.status < 400) {
      return { id, url, status: response.status, verdict: 'ok' };
    }
    return {
      id,
      url,
      status: response.status,
      verdict: SOFT_FAIL.has(response.status) ? 'soft' : 'dead',
    };
  } catch (error) {
    const code = errorCode(error);

    if (TLS_ERRORS.has(code)) {
      return { id, url, status: 'TLS', verdict: 'tls' };
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return { id, url, status: 'TIMEOUT', verdict: 'dead' };
    }
    return { id, url, status: code || 'ERROR', verdict: 'dead' };
  }
}

const MARK: Record<Verdict, string> = {
  ok: 'OK  ',
  soft: 'WARN',
  tls: 'TLS ',
  dead: 'FAIL',
};

async function run(): Promise<void> {
  console.log(`[check:links] 开始巡检 ${RESOURCES.length} 个链接，并发 ${CONCURRENCY}\n`);

  const results: Result[] = [];
  const queue = [...RESOURCES];

  async function worker(): Promise<void> {
    for (;;) {
      const resource = queue.shift();
      if (!resource) return;
      const result = await checkOne(resource.id, resource.url);
      results.push(result);
      const detail = result.verdict === 'ok' ? '' : `  ← ${String(result.status)}`;
      console.log(`  ${MARK[result.verdict]} ${resource.id.padEnd(26)}${detail}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const by = (v: Verdict) => results.filter((r) => r.verdict === v);
  const ok = by('ok');
  const soft = by('soft');
  const tls = by('tls');
  const dead = by('dead');

  console.log(`\n${'='.repeat(60)}`);
  console.log(`可访问 ${ok.length} · 存疑 ${soft.length} · 证书未验证 ${tls.length} · 失效 ${dead.length}`);

  if (soft.length > 0) {
    console.log('\n存疑（很可能是反爬拦截，建议人工点一次确认）：');
    for (const r of soft) console.log(`  ${String(r.status).padEnd(6)} ${r.id}  ${r.url}`);
  }

  if (tls.length > 0) {
    console.log('\n证书未验证（通常是本机 TLS 拦截代理导致，不代表链接失效）：');
    for (const r of tls) console.log(`  ${r.id}  ${r.url}`);
    console.log('  重跑方式：node --use-system-ca node_modules/tsx/dist/cli.mjs src/seed/check-links.ts');
  }

  if (dead.length > 0) {
    console.log('\n失效（必须修复）：');
    for (const r of dead) console.log(`  ${String(r.status).padEnd(8)} ${r.id}  ${r.url}`);
    process.exitCode = 1;
  } else if (tls.length === 0) {
    console.log('\n没有发现失效链接。');
  } else {
    console.log('\n除证书未验证的条目外，没有发现失效链接。');
  }
}

run().catch((error: unknown) => {
  console.error('[check:links] 运行失败：', error);
  process.exitCode = 1;
});
