import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_TARGET = process.env.AIFS_API_TARGET ?? 'http://localhost:8787';

export default defineConfig(({ mode }) => {
  const isDemo = mode === 'demo';

  return {
    // 演示模式用相对路径：构建产物可以直接双击打开，
    // 也可以丢到任意子目录的静态托管上，不需要额外配置。
    base: isDemo ? './' : '/',
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // 前端与 API 同源：cookie 认证不需要处理跨域，SameSite=Lax 就够用了。
      // 演示模式不会发出任何请求，这段代理配置用不上，但留着无害。
      proxy: {
        '/api': { target: API_TARGET, changeOrigin: true },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  };
});
