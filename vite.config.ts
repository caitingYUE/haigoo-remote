import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    // 配置代理，将API请求转发到Vercel开发服务器
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('API proxy error:', err)
          })
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