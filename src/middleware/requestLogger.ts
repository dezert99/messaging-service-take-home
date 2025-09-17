import morgan from 'morgan';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

// Custom token for request ID
morgan.token('id', (req: any) => req.id);

// Custom token for request body size
morgan.token('body-size', (req: Request) => {
  return req.get('content-length') || '0';
});

// Custom token for correlation ID
morgan.token('correlation-id', (req: any) => req.correlationId || '-');

// Stream to pipe morgan output to winston
const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

// Development format - more detailed
const devFormat = ':method :url :status :response-time ms - :res[content-length] bytes';

// Production format - structured
const prodFormat = JSON.stringify({
  method: ':method',
  url: ':url',
  status: ':status',
  responseTime: ':response-time',
  contentLength: ':res[content-length]',
  userAgent: ':user-agent',
  ip: ':remote-addr',
  correlationId: ':correlation-id'
});

export const requestLogger = morgan(
  process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
  { 
    stream,
    skip: (req: Request, res: Response) => {
      // Skip health check logs in production to reduce noise
      return process.env.NODE_ENV === 'production' && req.path === '/health';
    }
  }
);

// Request ID middleware - adds unique ID to each request
export const requestIdMiddleware = (req: any, res: Response, next: Function) => {
  req.id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.correlationId = req.headers['x-correlation-id'] || req.id;
  
  // Add correlation ID to response headers
  res.setHeader('X-Correlation-ID', req.correlationId);
  
  next();
};

// Enhanced request logging middleware with more details
export const detailedRequestLogger = (req: Request, res: Response, next: Function) => {
  const start = Date.now();
  
  // Log request start
  logger.debug('Request started', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    correlationId: (req as any).correlationId
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const duration = Date.now() - start;
    
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      contentLength: res.get('Content-Length'),
      correlationId: (req as any).correlationId
    });

    // Call original end method with proper arguments
    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
};