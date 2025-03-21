import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '192.168.8.150',  // Frontend IP
    port: 3000,
    https: {
      key: fs.readFileSync('.cert/key.pem'),
      cert: fs.readFileSync('.cert/cert.pem'),
    },
    proxy: {
      '/api': {
        target: 'http://192.168.8.150:5000',  // Backend server IP
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path
      },
      '/socket.io': {
        target: 'http://192.168.8.150:5000',  // Backend server IP
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  }
})
