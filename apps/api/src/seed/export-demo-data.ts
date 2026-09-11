import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUIZ_QUESTIONS } from './quizzes.js';
import { RESOURCES } from './resources.js';
import { assertSeedValid } from './validate.js';

/**
 * 把真实的种子数据导出成前端演示模式使用的 JSON。
 *
 * 目的：演示模式必须展示与真实产品完全一致的内容（48 个资源、36 道题），
 * 而不是另写一份"看起来差不多"的假数据。所以这里直接复用种子数据，
 * 保证两边永远同步——改了课程资源，重跑这个脚本即可。
 *
 * 注意：导出的是**含答案的完整题目**。演示模式的判卷在浏览器里进行，
 * 答案必然会下发到客户端——这在演示场景下可以接受（没有诚信问题），
 * 但绝不能把这个文件用到真实后端上。
 *
 * 用法：npm run demo:data
 */
function main(): void {
  // 先校验，避免把坏数据导出到前端
  assertSeedValid(RESOURCES, QUIZ_QUESTIONS);

  // 刻意**不写入时间戳**：导出结果只取决于种子数据本身，
  // 这样重复运行 `npm run demo:data` 在内容没变时不会产生 git diff。
  const data = {
    resourceCount: RESOURCES.length,
    questionCount: QUIZ_QUESTIONS.length,
    resources: RESOURCES,
    questions: QUIZ_QUESTIONS,
  };

  const target = fileURLToPath(new URL('../../../web/src/demo/data.json', import.meta.url));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  const perStage = new Map<string, number>();
  for (const resource of RESOURCES) {
    perStage.set(resource.stage, (perStage.get(resource.stage) ?? 0) + 1);
  }

  console.log(`[demo:data] 已导出 ${RESOURCES.length} 个资源、${QUIZ_QUESTIONS.length} 道题`);
  console.log(`[demo:data] 每阶段资源数：${[...perStage].map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`[demo:data] 输出：${target}`);
}

main();
