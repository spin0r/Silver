import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Proxy raw file extensions directly to Express backend
      '^/.*\\.(pdf|png|jpg|jpeg|gif|svg|webp|mp4|webm|ogg|mp3|wav|txt|md|json|xml|csv|py|java|c|cpp|h|sh|yml|yaml|zip|rar|7z|tar|gz|doc|docx|xls|xlsx|ppt|pptx)$': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
