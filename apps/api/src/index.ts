import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db/index.js';
import { ensureSeeded } from './seed/seed.js';

const config = loadConfig();
const db = openDatabase(config.dbPath);

// 首次启动自动灌入种子数据，避免「装完是空站」的糟糕第一印象。
const seedResult = ensureSeeded(db);
if (seedResult.inserted) {
  console.log(
    `[api] 已初始化种子数据：${seedResult.resources} 个资源、${seedResult.questions} 道自测题`,
  );
}

const app = createApp({ db, config });

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[api] 服务已启动: http://localhost:${info.port}`);
  console.log(`[api] 数据库: ${config.dbPath}`);
});

/** 优雅退出：关掉连接再退出，避免 WAL 文件残留。 */
function shutdown(signal: string) {
  console.log(`\n[api] 收到 ${signal}，正在关闭...`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
