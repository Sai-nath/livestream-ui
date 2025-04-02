import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  
  // Development server configuration
  const devConfig = {
    plugins: [react()],
    server: {
      host: '0.0.0.0',  // Allow connections from all network interfaces
      port: 3000,
      https: fs.existsSync('.cert/key.pem') && fs.existsSync('.cert/cert.pem') ? {
        key: fs.readFileSync('.cert/key.pem'),
        cert: fs.readFileSync('.cert/cert.pem'),
      } : undefined,
      proxy: {
        '/api': {
          target: 'https://livestreaming-fjghamgvdsdbd7ct.centralindia-01.azurewebsites.net',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path
        },
        '/socket.io': {
          target: 'https://livestreaming-fjghamgvdsdbd7ct.centralindia-01.azurewebsites.net',
          changeOrigin: true,
          secure: false,
          ws: true
        }
      }
    }
  };
  
  // Production build configuration
  const prodConfig = {
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: true
    }
  };
  
  return isDev ? devConfig : prodConfig;
})
