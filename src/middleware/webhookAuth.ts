import { Request, Response, NextFunction } from 'express';
import { verifyTwilioSignature, verifySendGridSignature, isTimestampValid } from '../utils/crypto';
import { logger } from '../utils/logger';

export function verifyTwilioWebhook(req: Request, res: Response, next: NextFunction): void {
  // Skip verification if not configured or in test mode
  if (!process.env.TWILIO_AUTH_TOKEN || process.env.SKIP_WEBHOOK_AUTH === 'true') {
    logger.debug('Twilio webhook auth skipped', {
      reason: !process.env.TWILIO_AUTH_TOKEN ? 'No auth token configured' : 'Skip auth enabled'
    });
    return next();
  }
  
  const signature = req.headers['x-twilio-signature'] as string;
  if (!signature) {
    logger.warn('Missing Twilio signature header', {
      url: req.originalUrl,
      headers: Object.keys(req.headers)
    });
    res.status(401).json({ error: 'Missing signature' });
    return;
  }
  
  // Construct the full URL
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const url = `${protocol}://${host}${req.originalUrl}`;
  
  // Verify signature
  const isValid = verifyTwilioSignature(
    signature,
    process.env.TWILIO_AUTH_TOKEN,
    url,
    req.body
  );
  
  if (!isValid) {
    logger.warn('Invalid Twilio signature', {
      url,
      signature,
      body: req.body
    });
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }
  
  logger.debug('Twilio signature verified', { url });
  next();
}

export function verifySendGridWebhook(req: Request, res: Response, next: NextFunction): void {
  // Skip verification if not configured or in test mode
  if (!process.env.SENDGRID_WEBHOOK_PUBLIC_KEY || process.env.SKIP_WEBHOOK_AUTH === 'true') {
    logger.debug('SendGrid webhook auth skipped', {
      reason: !process.env.SENDGRID_WEBHOOK_PUBLIC_KEY ? 'No public key configured' : 'Skip auth enabled'
    });
    return next();
  }
  
  const signature = req.headers['x-twilio-email-event-webhook-signature'] as string;
  const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string;
  
  if (!signature || !timestamp) {
    logger.warn('Missing SendGrid signature or timestamp headers', {
      url: req.originalUrl,
      hasSignature: !!signature,
      hasTimestamp: !!timestamp
    });
    res.status(401).json({ error: 'Missing signature or timestamp' });
    return;
  }
  
  // Verify timestamp is recent (within 5 minutes)
  if (!isTimestampValid(timestamp)) {
    logger.warn('SendGrid timestamp too old', {
      timestamp,
      currentTime: Math.floor(Date.now() / 1000)
    });
    res.status(401).json({ error: 'Timestamp too old' });
    return;
  }
  
  // IMPORTANT: Use raw payload for SendGrid ECDSA verification
  // The body must be the raw string/buffer, not parsed JSON
  const rawPayload = (req as any).rawBody || JSON.stringify(req.body);
  
  // Verify ECDSA signature using official SendGrid library
  const isValid = verifySendGridSignature(
    signature,
    process.env.SENDGRID_WEBHOOK_PUBLIC_KEY,
    timestamp,
    rawPayload
  );
  
  if (!isValid) {
    logger.warn('Invalid SendGrid ECDSA signature', {
      signature,
      timestamp,
      payloadLength: rawPayload.length,
      hasRawBody: !!(req as any).rawBody
    });
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }
  
  logger.debug('SendGrid ECDSA signature verified', { timestamp });
  next();
}