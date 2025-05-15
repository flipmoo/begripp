/**
 * Polyfill for Node.js process object in browser environments
 *
 * This file provides a minimal implementation of the Node.js process object
 * to allow Node.js-specific code to run in the browser without errors.
 */

// Create a mock process object for browser environments
const createMockProcess = () => {
  return {
    env: {},
    cwd: function() { return '/'; },
    nextTick: (fn: Function, ...args: any[]) => setTimeout(() => fn(...args), 0),
    browser: true,
    version: '',
    versions: {},
    platform: 'browser',
    release: {},
    config: {},
    title: 'browser',
    argv: [],
    pid: 0,
    arch: '',
    execPath: '',
    debugPort: 0,
    execArgv: [],
    hrtime: () => [0, 0],
    stdout: null,
    stderr: null,
    stdin: null,
  };
};

// Check if process is already defined (in Node.js environments)
if (typeof window !== 'undefined') {
  if (typeof (window as any).process === 'undefined') {
    console.log('Creating mock process object for browser environment');
    (window as any).process = createMockProcess();
  } else {
    // Ensure cwd is a function
    if (typeof (window as any).process.cwd !== 'function') {
      console.log('Fixing process.cwd in browser environment');
      (window as any).process.cwd = function() { return '/'; };
    }
  }
}

export {};
