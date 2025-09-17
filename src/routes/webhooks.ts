import { Router } from 'express';
import { 
  handleInboundSms, 
  handleInboundEmail, 
  handleTwilioStatusWebhook, 
  handleSendGridEventWebhook 
} from '../controllers/webhookController';
import { verifyTwilioWebhook, verifySendGridWebhook } from '../middleware/webhookAuth';
import { validateRequest, inboundSmsWebhookSchema, inboundEmailWebhookSchema } from '../middleware/validation';

const router = Router();

// Inbound message webhooks
router.post('/sms', verifyTwilioWebhook, validateRequest(inboundSmsWebhookSchema), handleInboundSms);
router.post('/email', verifySendGridWebhook, validateRequest(inboundEmailWebhookSchema), handleInboundEmail);

// Status update webhooks
router.post('/sms/status', verifyTwilioWebhook, handleTwilioStatusWebhook);
router.post('/email/events', verifySendGridWebhook, handleSendGridEventWebhook);

export default router;