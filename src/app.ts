import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import messageRoutes from './routes/messages';

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: process.env.MAX_PAYLOAD_SIZE || '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

app.use('/api/messages', messageRoutes);

app.use('/api/webhooks', (req, res) => {
  res.json({ message: 'Webhooks API endpoint - not implemented yet' });
});

app.use('/api/conversations', (req, res) => {
  res.json({ message: 'Conversations API endpoint - not implemented yet' });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;