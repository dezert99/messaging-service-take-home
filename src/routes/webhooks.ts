import { Router } from 'express';
import { 
  handleInboundSms, 
  handleInboundEmail, 
  handleTwilioStatusWebhook, 
  handleSendGridEventWebhook 
} from '../controllers/webhookController';

const router = Router();

// Inbound message webhooks
router.post('/sms', handleInboundSms);
router.post('/email', handleInboundEmail);

// Status update webhooks
router.post('/sms/status', handleTwilioStatusWebhook);
router.post('/email/events', handleSendGridEventWebhook);

export default router;