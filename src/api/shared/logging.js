/**
 * Gestandaardiseerde logging voor API endpoints
 */

// Constanten voor log levels
export const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

// Default log level
let currentLogLevel = LOG_LEVELS.INFO;

// Log level checkers
const shouldLogDebug = () => 
  [LOG_LEVELS.DEBUG].includes(currentLogLevel);

const shouldLogInfo = () => 
  [LOG_LEVELS.DEBUG, LOG_LEVELS.INFO].includes(currentLogLevel);

const shouldLogWarn = () => 
  [LOG_LEVELS.DEBUG, LOG_LEVELS.INFO, LOG_LEVELS.WARN].includes(currentLogLevel);

const shouldLogError = () => true; // Errors altijd loggen

// Logging functie met timestamp
const logWithTimestamp = (level, message, ...args) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`, ...args);
};

// Logger instance
export const logger = {
  // Log level setter
  setLogLevel: (level) => {
    if (Object.values(LOG_LEVELS).includes(level)) {
      currentLogLevel = level;
      logger.info(`Log level set to ${level}`);
    } else {
      logger.warn(`Invalid log level: ${level}. Using ${currentLogLevel}`);
    }
  },
  
  // Log methods
  debug: (message, ...args) => {
    if (shouldLogDebug()) {
      logWithTimestamp(LOG_LEVELS.DEBUG, message, ...args);
    }
  },
  
  info: (message, ...args) => {
    if (shouldLogInfo()) {
      logWithTimestamp(LOG_LEVELS.INFO, message, ...args);
    }
  },
  
  warn: (message, ...args) => {
    if (shouldLogWarn()) {
      logWithTimestamp(LOG_LEVELS.WARN, message, ...args);
    }
  },
  
  error: (message, ...args) => {
    if (shouldLogError()) {
      logWithTimestamp(LOG_LEVELS.ERROR, message, ...args);
    }
  },
  
  // Specifieke API logging helpers
  apiRequest: (method, path, params = {}) => {
    if (shouldLogDebug()) {
      logWithTimestamp(LOG_LEVELS.DEBUG, `API Request: ${method} ${path}`, params);
    }
  },
  
  apiResponse: (method, path, status, responseTime) => {
    if (shouldLogInfo()) {
      logWithTimestamp(LOG_LEVELS.INFO, `API Response: ${method} ${path} ${status} (${responseTime}ms)`);
    }
  },
  
  apiError: (method, path, error) => {
    logWithTimestamp(LOG_LEVELS.ERROR, `API Error: ${method} ${path}`, error);
  }
};

// Express middleware voor request logging
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log de inkomende request
  logger.apiRequest(req.method, req.path, { 
    query: req.query, 
    params: req.params 
  });
  
  // Onderschep de response
  const originalSend = res.send;
  res.send = function(body) {
    const responseTime = Date.now() - start;
    logger.apiResponse(req.method, req.path, res.statusCode, responseTime);
    return originalSend.call(this, body);
  };
  
  next();
}; 