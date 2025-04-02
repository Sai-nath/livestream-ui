import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import networkConfig from '../network-config'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: networkConfig.networkIP,  // Use centralized network IP
    port: networkConfig.frontend.port,
    https: {
      key: fs.readFileSync('.cert/key.pem'),
      cert: fs.readFileSync('.cert/cert.pem'),
    },
    proxy: {
      '/api': {
        target: networkConfig.backend.url,  // Use centralized backend URL
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path
      },
      '/socket.io': {
        target: networkConfig.backend.url,  // Use centralized backend URL
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  }
})
