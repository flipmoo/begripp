/**
 * Mock implementation of the Node.js url module for browser environments
 * 
 * This file provides a mock implementation of the url module
 * to prevent errors when importing url in browser code.
 */

// Create a mock implementation of the url module
const url = {
  fileURLToPath: (url: string): string => {
    console.warn(`Mock url.fileURLToPath called for URL: ${url}`);
    // Simple implementation that converts a file URL to a path
    if (url.startsWith('file://')) {
      return url.slice(7);
    }
    return url;
  },
  
  pathToFileURL: (path: string): URL => {
    console.warn(`Mock url.pathToFileURL called for path: ${path}`);
    // Simple implementation that converts a path to a file URL
    return new URL(`file://${path}`);
  },
  
  parse: (urlString: string): any => {
    console.warn(`Mock url.parse called for URL: ${urlString}`);
    // Use the browser's URL API to parse the URL
    try {
      const parsedUrl = new URL(urlString);
      return {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        pathname: parsedUrl.pathname,
        search: parsedUrl.search,
        hash: parsedUrl.hash
      };
    } catch (error) {
      return {};
    }
  },
  
  format: (urlObject: any): string => {
    console.warn(`Mock url.format called`);
    // Simple implementation that formats a URL object
    try {
      return new URL(urlObject).toString();
    } catch (error) {
      return '';
    }
  },
  
  resolve: (from: string, to: string): string => {
    console.warn(`Mock url.resolve called for from: ${from}, to: ${to}`);
    // Simple implementation that resolves a URL
    try {
      return new URL(to, from).toString();
    } catch (error) {
      return to;
    }
  }
};

export const fileURLToPath = url.fileURLToPath;
export const pathToFileURL = url.pathToFileURL;
export const parse = url.parse;
export const format = url.format;
export const resolve = url.resolve;

export default url;
