import express from 'express';
import { createProxyMiddleware, type Options } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import type { Request, Response } from 'express';
import type { ClientRequest, IncomingMessage } from 'http';

// Load environment variables
dotenv.config();

const GRIPP_API_KEY = process.env.VITE_GRIPP_API_KEY;

if (!GRIPP_API_KEY) {
  throw new Error('VITE_GRIPP_API_KEY is required');
}

const app = express();

// Configure proxy
const proxy = createProxyMiddleware({
  target: 'https://api.gripp.com',
  changeOrigin: true,
  pathRewrite: {
    '^/': '/'  // remove /api prefix
  },
  onProxyReq: (proxyReq: ClientRequest, req: IncomingMessage) => {
    // Set headers
    proxyReq.setHeader('Authorization', `Bearer ${GRIPP_API_KEY}`);
    proxyReq.setHeader('Content-Type', 'application/json');
    proxyReq.setHeader('Accept', 'application/json');

    // Handle POST request body
    if (req.method === 'POST' && req.readable) {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });
      req.on('end', () => {
        if (body) {
          proxyReq.setHeader('Content-Length', Buffer.byteLength(body));
          proxyReq.write(body);
        }
        proxyReq.end();
      });
    } else {
      proxyReq.end();
    }
  },
  onProxyRes: (proxyRes: IncomingMessage) => {
    console.log(`Proxy response: ${proxyRes.statusCode}`);
  },
  onError: (err: Error, req: Request, res: Response) => {
    console.error('Proxy error:', err);
    res.writeHead(500, {
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
  }
} as Options);

// Mount proxy for all requests
app.use('/', proxy);

// Start server
const PORT = 3002;
app.listen(PORT, () => {
  console.log(`Dev proxy running at http://localhost:${PORT}`);
}).on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  } else {
    console.error('Server error:', error);
  }
  process.exit(1);
}); 
