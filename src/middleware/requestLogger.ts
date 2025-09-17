import morgan from 'morgan';
import { logger } from '../utils/logger';

const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

export const requestLogger = morgan(
  ':remote-addr - :remote-user ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms',
  { stream }
);