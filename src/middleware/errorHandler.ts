import { Request, Response, NextFunction } from 'express';
import { logError, logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
}

export class ValidationError extends Error {
  statusCode = 400;
  isOperational = true;
  code = 'VALIDATION_ERROR';

  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  isOperational = true;
  code = 'NOT_FOUND';

  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends Error {
  statusCode = 429;
  isOperational = true;
  code = 'RATE_LIMIT_EXCEEDED';

  constructor(message = 'Rate limit exceeded', public retryAfter?: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class ProviderError extends Error {
  statusCode = 502;
  isOperational = true;
  code = 'PROVIDER_ERROR';

  constructor(message: string, public provider: string, public providerCode?: string) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class DatabaseError extends Error {
  statusCode = 500;
  isOperational = true;
  code = 'DATABASE_ERROR';

  constructor(message: string, public operation?: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class AuthenticationError extends Error {
  statusCode = 401;
  isOperational = true;
  code = 'AUTHENTICATION_ERROR';

  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  statusCode = 403;
  isOperational = true;
  code = 'AUTHORIZATION_ERROR';

  constructor(message = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

// Async error wrapper for route handlers
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Enhanced error handler with better logging and response format
export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { statusCode = 500, message, code, name } = err;
  
  // Enhanced error logging with request context
  logError(err, {
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    body: req.body,
    query: req.query,
    params: req.params,
    headers: {
      'content-type': req.get('Content-Type'),
      'authorization': req.get('Authorization') ? '[REDACTED]' : undefined
    }
  });

  // Generate correlation ID for error tracking
  const correlationId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Determine if we should expose error details
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const isOperationalError = err.isOperational || statusCode < 500;

  // Build error response
  const errorResponse: any = {
    error: {
      message: isOperationalError ? message : 'Internal server error',
      code: code || 'UNKNOWN_ERROR',
      correlationId
    }
  };

  // Add additional details based on error type and environment
  if (err instanceof ValidationError && err.details) {
    errorResponse.error.details = err.details;
  }

  if (err instanceof RateLimitError && err.retryAfter) {
    res.setHeader('Retry-After', err.retryAfter);
    errorResponse.error.retryAfter = err.retryAfter;
  }

  if (err instanceof ProviderError) {
    errorResponse.error.provider = err.provider;
    if (err.providerCode) {
      errorResponse.error.providerCode = err.providerCode;
    }
  }

  // Add debug info in development
  if (isDevelopment) {
    errorResponse.error.name = name;
    errorResponse.error.stack = err.stack;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

// Enhanced 404 handler
export const notFoundHandler = (req: Request, res: Response) => {
  logger.warn('Route not found', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  res.status(404).json({
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: 'ROUTE_NOT_FOUND',
      method: req.method,
      path: req.path
    }
  });
};

// Uncaught exception handler
export const handleUncaughtException = (err: Error) => {
  logError(err, { type: 'uncaughtException' });
  logger.error('Uncaught Exception! Shutting down...', { error: err.message });
  process.exit(1);
};

// Unhandled rejection handler
export const handleUnhandledRejection = (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection! Shutting down...', { 
    reason: reason?.message || reason,
    stack: reason?.stack 
  });
  process.exit(1);
};