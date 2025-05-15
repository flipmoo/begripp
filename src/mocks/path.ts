/**
 * Mock implementation of the Node.js path module for browser environments
 * 
 * This file provides a mock implementation of the path module
 * to prevent errors when importing path in browser code.
 */

// Create a mock implementation of the path module
const path = {
  join: (...paths: string[]): string => {
    // Simple implementation that joins paths with a forward slash
    return paths.join('/').replace(/\/+/g, '/');
  },
  
  resolve: (...paths: string[]): string => {
    // Simple implementation that resolves paths
    return paths.join('/').replace(/\/+/g, '/');
  },
  
  dirname: (path: string): string => {
    // Simple implementation that returns the directory name
    return path.split('/').slice(0, -1).join('/');
  },
  
  basename: (path: string, ext?: string): string => {
    // Simple implementation that returns the base name
    const base = path.split('/').pop() || '';
    if (ext && base.endsWith(ext)) {
      return base.slice(0, -ext.length);
    }
    return base;
  },
  
  extname: (path: string): string => {
    // Simple implementation that returns the extension
    const base = path.split('/').pop() || '';
    const i = base.lastIndexOf('.');
    if (i < 0) {
      return '';
    }
    return base.slice(i);
  },
  
  parse: (path: string): any => {
    // Simple implementation that parses a path
    const base = path.split('/').pop() || '';
    const dir = path.slice(0, -base.length);
    const ext = base.includes('.') ? `.${base.split('.').pop()}` : '';
    const name = ext ? base.slice(0, -ext.length) : base;
    return {
      root: '',
      dir,
      base,
      ext,
      name
    };
  },
  
  format: (pathObject: any): string => {
    // Simple implementation that formats a path object
    return `${pathObject.dir}/${pathObject.base}`;
  },
  
  normalize: (path: string): string => {
    // Simple implementation that normalizes a path
    return path.replace(/\/+/g, '/');
  },
  
  isAbsolute: (path: string): boolean => {
    // Simple implementation that checks if a path is absolute
    return path.startsWith('/');
  },
  
  relative: (from: string, to: string): string => {
    // Simple implementation that returns the relative path
    return to;
  },
  
  sep: '/'
};

export const join = path.join;
export const resolve = path.resolve;
export const dirname = path.dirname;
export const basename = path.basename;
export const extname = path.extname;
export const parse = path.parse;
export const format = path.format;
export const normalize = path.normalize;
export const isAbsolute = path.isAbsolute;
export const relative = path.relative;
export const sep = path.sep;

export default path;
