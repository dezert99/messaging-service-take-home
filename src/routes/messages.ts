import { Router } from 'express';
import { sendSms, sendEmail } from '../controllers/messageController';
import { validateRequest, sendSmsSchema, sendEmailSchema } from '../middleware/validation';
import { createRateLimiter } from '../middleware/rateLimiter';
import { rateLimits } from '../config/rateLimits';

const router = Router();

// Create rate limiters for each endpoint
const smsRateLimiter = createRateLimiter(rateLimits.sms);
const emailRateLimiter = createRateLimiter(rateLimits.email);

// SMS/MMS endpoint
router.post('/sms', 
  smsRateLimiter.middleware(),
  validateRequest(sendSmsSchema),
  sendSms
);

// Email endpoint
router.post('/email',
  emailRateLimiter.middleware(),
  validateRequest(sendEmailSchema),
  sendEmail
);

export default router;