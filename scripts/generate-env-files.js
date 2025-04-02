/**
 * Script to generate environment files based on centralized network configuration
 */

const fs = require('fs');
const path = require('path');
const networkConfig = require('../src/config/network-config');

// Generate frontend environment files
const generateFrontendEnvFiles = () => {
  const frontendDir = path.join(__dirname, '..');
  
  // Development environment
  const devEnvContent = `# Development Environment Variables
VITE_API_URL=${networkConfig.backend.url}
VITE_SOCKET_URL=${networkConfig.backend.wsUrl}
VITE_FRONTEND_URL=${networkConfig.frontend.url}
`;

  // Production environment
  const prodEnvContent = `# Production Environment Variables
VITE_API_URL=https://livestreaming-fjghamgvdsdbd7ct.centralindia-01.azurewebsites.net
VITE_SOCKET_URL=wss://livestreaming-fjghamgvdsdbd7ct.centralindia-01.azurewebsites.net
VITE_FRONTEND_URL=https://nice-sea-057f1c900.4.azurestaticapps.net
`;

  try {
    fs.writeFileSync(path.join(frontendDir, '.env.development'), devEnvContent);
    fs.writeFileSync(path.join(frontendDir, '.env.production'), prodEnvContent);
    console.log('Frontend environment files generated successfully');
  } catch (error) {
    console.error('Error generating frontend environment files:', error);
  }
};

// Run the generator
generateFrontendEnvFiles();

console.log('Frontend environment files have been generated based on the network configuration');
