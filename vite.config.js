import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.NODE_ENV === 'production' 
          ? 'https://livestreamingclaims-hpaedbd6b6gbhkb0.centralindia-01.azurewebsites.net'
          : 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: process.env.NODE_ENV === 'production'
          ? 'https://livestreamingclaims-hpaedbd6b6gbhkb0.centralindia-01.azurewebsites.net'
          : 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['react-icons', 'react-toastify']
        }
      }
    },
    assetsInlineLimit: 4096,
    sourcemap: true
  },
  base: './',
  experimental: {
    renderBuiltUrl(filename) {
      return `/${filename}`
    }
  }
})
