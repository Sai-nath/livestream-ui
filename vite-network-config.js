/**
 * Simplified network configuration for Vite config
 * This file is used only by vite.config.js and avoids using import.meta.env
 */

export default {
  // Network IP Configuration
  networkIP: '192.168.8.120', // Current local network IP
  
  // Frontend Configuration
  frontend: {
    protocol: 'https',
    port: 3000,
    get url() {
      return `${this.protocol}://192.168.8.120:${this.port}`;
    }
  },
  
  // Backend Configuration
  backend: {
    protocol: 'https', // Using HTTPS for secure connections
    port: 5000,
    get url() {
      return `${this.protocol}://192.168.8.120:${this.port}`;
    },
    get wsUrl() {
      return `${this.protocol}://192.168.8.120:${this.port}`;
    }
  }
};
