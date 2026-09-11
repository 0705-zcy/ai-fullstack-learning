import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // 种子数据校验和安全相关的测试会做 scrypt 派生，给足超时
    testTimeout: 20_000,
  },
});
