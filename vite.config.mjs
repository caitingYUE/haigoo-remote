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
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  },
  build: {
    outDir: 'dist',
    // sourcemap: false, // 生产环境关闭sourcemap
    // minify: 'terser', // 使用Terser进行代码压缩和混淆
    // terserOptions: {
    //   compress: {
    //     drop_console: false, // 移除console.log
    //     drop_debugger: true, // 移除debugger
    //     pure_funcs: ['console.info'] // 移除特定函数
    //   },
    //   mangle: {
    //     toplevel: true, // 混淆顶级变量名
    //     properties: {
    //       regex: /^_/ // 不混淆以下划线开头的属性
    //     }
    //   }
    // },
    // rollupOptions: {
    //   output: {
    //     manualChunks: {
    //       vendor: ['react', 'react-dom'],
    //       utils: ['axios', 'zustand']
    //     }
    //   }
    // }
  }
})
