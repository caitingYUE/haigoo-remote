import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import JavaScriptObfuscator from 'vite-plugin-javascript-obfuscator'

export default defineConfig({
  plugins: [
    react(),
    // ====== ⚠ 只混淆前端，不混 api/ ======
    // JavaScriptObfuscator({
    //   // 只对前端输出的 chunk 混淆
    //   include: [
    //     'assets/*.js',   // dist/assets/*.js 的浏览器代码
    //   ],
    //   exclude: [
    //     'api/**',        // 确保不混 Vercel serverless
    //   ],
    //   // 🔥 强混淆参数（安全，不会炸）
    //   options: {
    //     compact: true,
    //     controlFlowFlattening: true,
    //     controlFlowFlatteningThreshold: 0.75,
    //     deadCodeInjection: true,
    //     deadCodeInjectionThreshold: 0.4,
    //     stringArray: true,
    //     stringArrayThreshold: 0.8,
    //     rotateStringArray: true,
    //     renameGlobals: false,  // ⚠ 必须 false，否则 React/Vite 直接炸
    //     identifiersPrefix: 'xZy_', // 防止 clash
    //     selfDefending: true,
    //     debugProtection: true,
    //     disableConsoleOutput: true,
    //   }
    // })
  ],
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
  esbuild: {
    // 使用高速的 esbuild 抛弃 console 和 debugger，速度是 terser 的 20~40 倍
    drop: ['console', 'debugger'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // 生产环境关闭 sourcemap
    minify: 'esbuild', // 换回默认的高极速 esbuild
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
