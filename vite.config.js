import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    https: {
      key: fs.readFileSync('.cert/key.pem'),
      cert: fs.readFileSync('.cert/cert.pem'),
    },
    proxy: {
      '/api': {
        target: process.env.NODE_ENV === 'production' 
          ? 'https://livestreamingclaims-hpaedbd6b6gbhkb0.centralindia-01.azurewebsites.net'
          : 'http://192.168.8.120:5000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: process.env.NODE_ENV === 'production'
          ? 'https://livestreamingclaims-hpaedbd6b6gbhkb0.centralindia-01.azurewebsites.net'
          : 'http://192.168.8.120:5000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
})
