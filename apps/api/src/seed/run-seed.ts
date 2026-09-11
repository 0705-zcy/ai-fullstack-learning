import { loadConfig } from '../config.js';
import { openDatabase } from '../db/index.js';
import { seedDatabase } from './seed.js';

/** 手动灌种子数据：`npm run seed`。 */
const config = loadConfig();
const db = openDatabase(config.dbPath);

try {
  const result = seedDatabase(db);
  console.log(`[seed] 完成：${result.resources} 个资源、${result.questions} 道自测题`);
  console.log(`[seed] 数据库：${config.dbPath}`);
} catch (error) {
  console.error('[seed] 失败：', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  db.close();
}
