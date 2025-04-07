import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

async function killProcessOnPort(port: number): Promise<void> {
  try {
    console.log(`Attempting to kill process on port ${port}...`);
    // For macOS/Linux
    await execPromise(`lsof -ti:${port} | xargs kill -9`);
    console.log(`Successfully killed process on port ${port}`);
  } catch (error) {
    if (error.stderr && error.stderr.length > 0) {
      console.error(`Error killing process on port ${port}:`, error.stderr);
      throw new Error(`Failed to kill process on port ${port}: ${error.stderr}`);
    } else {
      // No error output means no process was found
      console.log(`No process found running on port ${port}`);
    }
  }
}

async function startAPIServer(): Promise<void> {
  console.log('Starting API server...');
  const child = exec('npm run api');
  
  child.stdout?.on('data', (data) => {
    console.log(`API server: ${data}`);
    if (data.includes('API server running on port')) {
      console.log('API server started successfully');
    }
  });
  
  child.stderr?.on('data', (data) => {
    console.error(`API server error: ${data}`);
  });
  
  return new Promise((resolve) => {
    // Wait 5 seconds to let the server start
    setTimeout(resolve, 5000);
  });
}

async function startFrontendServer(): Promise<void> {
  console.log('Starting frontend server...');
  const child = exec('npm run dev');
  
  child.stdout?.on('data', (data) => {
    console.log(`Frontend server: ${data}`);
    if (data.includes('Local:') && data.includes('http://localhost:3000')) {
      console.log('Frontend server started successfully');
    }
  });
  
  child.stderr?.on('data', (data) => {
    console.error(`Frontend server error: ${data}`);
  });
  
  return new Promise((resolve) => {
    // Wait 3 seconds to let the server start
    setTimeout(resolve, 3000);
  });
}

async function main() {
  try {
    // Kill existing processes on ports 3000 and 3002
    await killProcessOnPort(3000);
    await killProcessOnPort(3002);
    
    // Wait 1 second for ports to be freed up
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start API server first
    await startAPIServer();
    
    // Then start frontend server
    await startFrontendServer();
    
    console.log('Both servers started successfully');
    console.log('Visit http://localhost:3000 to access the application');
  } catch (error) {
    console.error('Error restarting servers:', error);
    process.exit(1);
  }
}

main(); 