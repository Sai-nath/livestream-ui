/**
 * Azure Static Web Apps Direct Deployment Script
 * 
 * This script builds and deploys the frontend directly to Azure Static Web Apps
 * without relying on GitHub Actions.
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file directory with ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const config = {
  // Your deployment token from Azure Static Web Apps
  deploymentToken: process.env.DEPLOYMENT_TOKEN || '37b669f1ef7694c1a5e6c65b2d8a8fdfd08d6af9ded960aa67474da27237b8bc04-5d3e6332-84b9-4143-a437-a4ac5028515c0002403057f1c900',
  // Build output directory
  distDir: path.join(__dirname, 'dist'),
  // Environment variables for the build
  env: {
    VITE_API_URL: 'https://livestreaming-fjghamgvdsdbd7ct.centralindia-01.azurewebsites.net',
    VITE_SOCKET_URL: 'wss://livestreaming-fjghamgvdsdbd7ct.centralindia-01.azurewebsites.net',
    VITE_APP_URL: 'https://thankful-dune-06ac8a600.6.azurestaticapps.net',
    VITE_AWS_REGION: 'eu-north-1',
    VITE_AWS_S3_BUCKET: 'lvsbucket-5181',
    NODE_ENV: 'production'
  }
};

// Create .env file with environment variables
function createEnvFile() {
  console.log('Creating .env file...');
  let envContent = '';
  
  for (const [key, value] of Object.entries(config.env)) {
    envContent += `${key}=${value}\n`;
  }
  
  fs.writeFileSync(path.join(__dirname, '.env'), envContent);
  console.log('Environment variables set successfully.');
}

// Run a command and return a promise
function runCommand(command) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command}`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return reject(error);
      }
      
      if (stderr) {
        console.log(`stderr: ${stderr}`);
      }
      
      console.log(`stdout: ${stdout}`);
      resolve(stdout);
    });
  });
}

// Main deployment function
async function deploy() {
  try {
    // 1. Create environment file
    createEnvFile();
    
    // 2. Install dependencies if needed
    console.log('Checking dependencies...');
    await runCommand('npm ci');
    
    // 3. Build the application
    console.log('Building application...');
    await runCommand('npm run build');
    
    // 4. Install SWA CLI if not already installed
    console.log('Installing Azure Static Web Apps CLI...');
    await runCommand('npm install -g @azure/static-web-apps-cli');
    
    // 5. Deploy to Azure Static Web Apps
    console.log('Deploying to Azure Static Web Apps...');
    await runCommand(`npx swa deploy "${config.distDir}" --env production --deployment-token ${config.deploymentToken}`);
    
    console.log('Deployment completed successfully!');
    console.log('Your app should be available at: https://thankful-dune-06ac8a600.6.azurestaticapps.net');
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

// Run the deployment
deploy();
