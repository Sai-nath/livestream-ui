import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import networkConfig from './vite-network-config.js'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  
  // Development server configuration
  const devConfig = {
    plugins: [react()],
    server: {
      host: networkConfig.networkIP,  // Use the centralized network IP
      port: networkConfig.frontend.port,
      https: fs.existsSync('.cert/key.pem') && fs.existsSync('.cert/cert.pem') ? {
        key: fs.readFileSync('.cert/key.pem'),
        cert: fs.readFileSync('.cert/cert.pem'),
      } : undefined,
      proxy: {
        '/api': {
          target: networkConfig.backend.url,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path
        },
        '/socket.io': {
          target: networkConfig.backend.wsUrl,
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (path) => path,
          configure: (proxy, options) => {
            proxy.on('error', (err, req, res) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log('Sending Request to the Target:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, res) => {
              console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
            });
          }
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
