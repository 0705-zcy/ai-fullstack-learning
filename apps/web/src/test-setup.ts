// 让 expect(...).toBeInTheDocument() 这类断言可用
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// @testing-library/react 的自动清理只在 globals: true 时生效。
// 我们的 vitest 配置刻意不开 globals，所以要显式注册，
// 否则 DOM 会在测试用例之间累积，导致 getByRole 报 "multiple elements found"。
afterEach(cleanup);
