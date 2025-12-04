import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  },
  preview: {
    port: 3001,
    strictPort: false,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // 生产环境关闭 sourcemap
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,      // 不移除所有 console
        drop_debugger: true,      // 移除 debugger
        pure_funcs: ['console.info'] // 移除 console.info
      },
      mangle: {
        toplevel: false,          // ❗不要混淆顶层变量（避免破坏 Vercel 入口）
        properties: {
          regex: /^[a-zA-Z]\w+$/,  // 只混淆你自己写的业务属性
          keep_quoted: true        // "xx" 这种不会被动
        }
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          utils: ['axios', 'zustand']
        }
      }
    }
  }
})
