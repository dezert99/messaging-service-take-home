import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { requestLogger, requestIdMiddleware } from './middleware/requestLogger';
import { 
  errorHandler, 
  notFoundHandler, 
  handleUncaughtException, 
  handleUnhandledRejection 
} from './middleware/errorHandler';
import { logger } from './utils/logger';
import messageRoutes from './routes/messages';
import webhookRoutes from './routes/webhooks';
import conversationRoutes from './routes/conversations';

dotenv.config();

// Set up global error handlers
process.on('uncaughtException', handleUncaughtException);
process.on('unhandledRejection', handleUnhandledRejection);

const app = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security and parsing middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ 
  limit: process.env.MAX_PAYLOAD_SIZE || '50mb',
  verify: (req: any, res, buf) => {
    // Store raw body for webhook signature verification
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Request tracking and logging
app.use(requestIdMiddleware);
app.use(requestLogger);

app.get('/health', async (req, res) => {
  try {
    // Basic health check
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };

    res.status(200).json(health);
  } catch (error) {
    logger.error('Health check failed', { error: (error as Error).message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

app.use('/api/messages', messageRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/conversations', conversationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;