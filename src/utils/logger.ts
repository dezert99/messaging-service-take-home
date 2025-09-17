import winston from 'winston';
import { Request } from 'express';

// Custom format for development
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

// Production format for structured logging
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  format: isDevelopment ? devFormat : prodFormat,
  defaultMeta: { 
    service: 'messaging-service',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    new winston.transports.Console({
      silent: process.env.NODE_ENV === 'test'
    })
  ]
});

// Add file transports for production
if (!isDevelopment) {
  logger.add(new winston.transports.File({ 
    filename: 'logs/error.log', 
    level: 'error',
    maxsize: 10485760, // 10MB
    maxFiles: 5
  }));
  logger.add(new winston.transports.File({ 
    filename: 'logs/combined.log',
    maxsize: 10485760, // 10MB  
    maxFiles: 10
  }));
}

// Utility functions for structured logging
export const logRequest = (req: Request, additionalData?: any) => {
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    ...additionalData
  });
};

export const logError = (error: Error, context?: any) => {
  logger.error('Application error', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...context
  });
};

export const logMessage = (action: string, messageData: any) => {
  logger.info('Message operation', {
    action,
    messageId: messageData.id,
    from: messageData.from,
    to: messageData.to,
    type: messageData.type,
    direction: messageData.direction,
    status: messageData.status
  });
};

export const logConversation = (action: string, conversationData: any) => {
  logger.info('Conversation operation', {
    action,
    conversationId: conversationData.id,
    participant1: conversationData.participant1,
    participant2: conversationData.participant2,
    channelType: conversationData.channelType
  });
};

export const logWebhook = (type: string, provider: string, data: any) => {
  logger.info('Webhook received', {
    type,
    provider,
    eventId: data.sg_event_id || data.MessageSid || 'unknown',
    timestamp: data.timestamp || new Date().toISOString()
  });
};