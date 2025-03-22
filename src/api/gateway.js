import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import employeesRouter from './domains/employees/router.js';
import projectsRouter from './domains/projects/router.js';
import absencesRouter from './domains/absences/router.js';
import holidaysRouter from './domains/holidays/router.js';
import { requestLogger, logger } from './shared/logging.js';

const app = express();
const port = 3003;

// Request parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Request logging middleware
app.use(requestLogger);

// Log startup informatie
logger.info(`API Gateway starting on port ${port}`);
logger.info('Registered domain routers:');
logger.info('- /api/employees');
logger.info('- /api/projects');
logger.info('- /api/absences');
logger.info('- /api/holidays');

// Domein-specifieke routes
app.use('/api/employees', employeesRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/absences', absencesRouter);
app.use('/api/holidays', holidaysRouter);

// Healthcheck endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API documentatie endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    version: '1.0.0',
    description: 'Het Nieuwe Werken API Gateway',
    domains: [
      { name: 'employees', base: '/api/employees', description: 'Employee data and operations' },
      { name: 'projects', base: '/api/projects', description: 'Project management' },
      { name: 'absences', base: '/api/absences', description: 'Leave and absence management' },
      { name: 'holidays', base: '/api/holidays', description: 'Holiday calendar configuration' }
    ]
  });
});

// Route alle overige requests naar huidige API server (transparant fallback)
app.use('/', createProxyMiddleware({ 
  target: 'http://localhost:3002',
  changeOrigin: true,
  // Debug logging
  onProxyReq: (proxyReq, req) => {
    logger.debug(`Proxying ${req.method} ${req.url} -> ${proxyReq.path}`);
  }
}));

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error in request', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// Start de server
app.listen(port, () => {
  logger.info(`API Gateway running on port ${port}`);
}); 