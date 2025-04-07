import { execSync, spawn } from 'child_process';

console.log('API Server Restart Script');
console.log('========================');

try {
  // Step 1: Kill the existing API server
  console.log('Killing existing API server...');
  try {
    execSync('npm run kill-api', { stdio: 'inherit' });
    console.log('API server killed successfully');
  } catch {
    console.log('No API server was running or could not be killed');
  }

  // Step 2: Small delay to ensure port is released
  console.log('Waiting for port to be released...');
  setTimeout(() => {
    try {
      // Step 3: Start a new API server
      console.log('Starting new API server...');
      
      // Using spawn instead of execSync for detached process
      const apiProcess = spawn('npm', ['run', 'api'], {
        stdio: 'inherit',
        detached: true,
        shell: true
      });
      
      // Unref to allow this script to exit independently
      apiProcess.unref();
      
      console.log('API server started successfully');

      // Step 4: Verify the API is running
      console.log('Verifying API server is running...');
      setTimeout(() => {
        try {
          const healthCheck = execSync('curl -s "http://localhost:3002/api/health"', {
            encoding: 'utf-8'
          });
          
          console.log('API health check response:', healthCheck);
          console.log('API restart completed successfully');
          process.exit(0);
        } catch (error) {
          console.error('API health check failed:', error);
          console.error('API may not have started correctly');
          process.exit(1);
        }
      }, 5000); // Wait 5 seconds before checking health
      
    } catch (error) {
      console.error('Failed to start API server:', error);
      process.exit(1);
    }
  }, 2000); // Wait 2 seconds after killing

} catch (error) {
  console.error('Error during API restart:', error);
  process.exit(1);
} 