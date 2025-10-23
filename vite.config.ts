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
      '/api/rss-proxy': {
        target: 'https://api.allorigins.win',
        changeOrigin: true,
        rewrite: (path) => {
          // 从 /api/rss-proxy?url=xxx 转换为 /get?url=xxx
          const url = new URL(path, 'http://localhost')
          const targetUrl = url.searchParams.get('url')
          return `/get?url=${encodeURIComponent(targetUrl || '')}`
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('RSS proxy error:', err)
          })
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('RSS proxy request:', req.url)
          })
        }
      }
    }
  },
})