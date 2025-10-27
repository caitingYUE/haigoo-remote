import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        configure: (proxy, options) => {
          // 处理API路由
          proxy.on('proxyReq', (proxyReq, req, res) => {
            if (req.url?.startsWith('/api/rss-proxy')) {
              // 重写为直接调用RSS代理函数
              const url = new URL(req.url, 'http://localhost:3000');
              const rssUrl = url.searchParams.get('url');
              if (rssUrl) {
                // 直接转发到RSS源
                proxyReq.path = rssUrl;
                proxyReq.setHeader('host', new URL(rssUrl).host);
              }
            }
          });
        }
      }
    }
  },
  // 配置构建选项
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})