/**
 * Central port configuration for the application
 * IMPORTANT: Changing these ports may break application functionality
 */

// Main application ports
export const FRONTEND_PORT = 3000;
export const API_PORT = 3002;

// Maximum retry attempts when port is in use
export const MAX_PORT_RETRY_ATTEMPTS = 3;

// Kill process on a specific port
export async function killProcessOnPort(port: number): Promise<boolean> {
  try {
    if (process.platform === 'win32') {
      // Windows command
      const { exec } = await import('child_process');
      exec(`netstat -ano | findstr :${port} | findstr LISTENING && FOR /F "tokens=5" %p in ('netstat -ano | findstr :${port} | findstr LISTENING') DO taskkill /F /PID %p`);
    } else {
      // macOS/Linux command
      const { exec } = await import('child_process');
      exec(`lsof -t -i:${port} | xargs kill -9 2>/dev/null || echo "No process on port ${port}"`);
    }
    return true;
  } catch (error) {
    console.error(`Failed to kill process on port ${port}:`, error);
    return false;
  }
}

// Get appropriate port command based on the platform
export function getPortKillCommand(port: number): string {
  if (process.platform === 'win32') {
    return `netstat -ano | findstr :${port} | findstr LISTENING && FOR /F "tokens=5" %p in ('netstat -ano | findstr :${port} | findstr LISTENING') DO taskkill /F /PID %p`;
  } else {
    return `lsof -t -i:${port} | xargs kill -9 2>/dev/null || echo "No process on port ${port}"`;
  }
} 