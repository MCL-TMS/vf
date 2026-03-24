import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@/components": path.resolve(__dirname, "./components"),
      "@/utils": path.resolve(__dirname, "./utils"),
      "@/data": path.resolve(__dirname, "./data"),
      "@/styles": path.resolve(__dirname, "./styles")
    },
  },
  server: {
    host: true,
    port: 3000,
    open: true,
    proxy: {
      '/api': {

        target: 'http://localhost:3001',

        target: 'http://127.0.0.1:3001',

        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => {

          console.log('🔄 [Vite代理] 重写路径:', path, '-> http://localhost:3001' + path);

          console.log('🔄 [Vite代理] 重写路径:', path, '-> http://127.0.0.1:3001' + path);

          return path;
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.error('🔥 [Vite代理] 代理错误:', err.message);
            console.error('🔥 [Vite代理] 请求URL:', req.url);

            console.error('🔥 [Vite代理] 目标:', 'http://localhost:3001' + req.url);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('🔄 [Vite代理] 发起代理请求:', req.method, req.url, '-> http://localhost:3001' + req.url);

            console.error('🔥 [Vite代理] 目标:', 'http://127.0.0.1:3001' + req.url);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('🔄 [Vite代理] 发起代理请求:', req.method, req.url, '-> http://127.0.0.1:3001' + req.url);

            console.log('🔄 [Vite代理] 请求头:', req.headers);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('📨 [Vite代理] 收到代理响应:', req.url, '状态:', proxyRes.statusCode, 'Content-Type:', proxyRes.headers['content-type']);
            if (proxyRes.statusCode >= 400) {
              console.error('📨 [Vite代理] 错误响应详情:', {
                url: req.url,
                status: proxyRes.statusCode,
                statusMessage: proxyRes.statusMessage,
                headers: proxyRes.headers
              });
            }
          });
        }
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
          ui: ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-select']
        }
      }
    }
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'lucide-react',
      'recharts',
      'clsx',
      'tailwind-merge'
    ]
  },
  css: {
    postcss: './postcss.config.js'
  }
})