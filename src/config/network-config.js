/**
 * Centralized Network Configuration
 * This file contains all IP addresses, ports, and URLs used across the application.
 * This configuration is used by both frontend and backend.
 */

const config = {
  // Network IP Configuration
  networkIP: '192.168.8.120', // Current local network IP
  
  // Frontend Configuration
  frontend: {
    protocol: 'https',
    port: 3000,
    get url() {
      return `${this.protocol}://${config.networkIP}:${this.port}`;
    }
  },
  
  // Backend Configuration
  backend: {
    protocol: 'https', // Using HTTPS for secure connections
    port: 5000,
    get url() {
      return `${this.protocol}://${config.networkIP}:${this.port}`;
    },
    get wsUrl() {
      return `${this.protocol}://${config.networkIP}:${this.port}`;
    }
  },
  
  // CORS Configuration
  cors: {
    // Additional allowed origins beyond the main frontend/backend
    additionalOrigins: [
      'http://localhost:3000',
      'https://localhost:3000',
      'http://localhost:5000',
      'https://localhost:5000',
      'http://192.168.8.120:3000',
      'https://192.168.8.120:3000',
      'http://192.168.8.120:5000',
      'https://192.168.8.120:5000',
      'https://livestreaming-fjghamgvdsdbd7ct.centralindia-01.azurewebsites.net',
      'https://nice-sea-057f1c900.4.azurestaticapps.net'
    ],
    
    // Get all allowed origins
    get allowedOrigins() {
      return [
        config.frontend.url,
        config.backend.url,
        ...this.additionalOrigins
      ];
    }
  },
  
  // AWS Configuration
  aws: {
    region: (typeof import.meta !== 'undefined' ? import.meta.env.VITE_AWS_REGION : process.env.VITE_AWS_REGION) || 'eu-north-1',
    s3Bucket: (typeof import.meta !== 'undefined' ? import.meta.env.VITE_AWS_S3_BUCKET : process.env.VITE_AWS_S3_BUCKET) || 'lvsbucket-5181',
    accessKeyId: (typeof import.meta !== 'undefined' ? import.meta.env.VITE_AWS_ACCESS_KEY_ID : process.env.VITE_AWS_ACCESS_KEY_ID),
    secretAccessKey: (typeof import.meta !== 'undefined' ? import.meta.env.VITE_AWS_SECRET_ACCESS_KEY : process.env.VITE_AWS_SECRET_ACCESS_KEY)
  },
  
  // Environment Detection
  isProduction: (typeof import.meta !== 'undefined' ? import.meta.env.MODE === 'production' : process.env.NODE_ENV === 'production'),
  isDevelopment: (typeof import.meta !== 'undefined' ? import.meta.env.MODE === 'development' : process.env.NODE_ENV === 'development')
  
};

export default config;
