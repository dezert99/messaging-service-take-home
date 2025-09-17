import { Router } from 'express';
import { 
  handleInboundSms, 
  handleInboundEmail, 
  handleTwilioStatusWebhook, 
  handleSendGridEventWebhook 
} from '../controllers/webhookController';
import { verifyTwilioWebhook, verifySendGridWebhook } from '../middleware/webhookAuth';

const router = Router();

// Inbound message webhooks
router.post('/sms', verifyTwilioWebhook, handleInboundSms);
router.post('/email', verifySendGridWebhook, handleInboundEmail);

// Status update webhooks
router.post('/sms/status', verifyTwilioWebhook, handleTwilioStatusWebhook);
router.post('/email/events', verifySendGridWebhook, handleSendGridEventWebhook);

export default router;