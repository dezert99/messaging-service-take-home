import { validateRequest } from 'twilio';
import { EventWebhook } from '@sendgrid/eventwebhook';

/**
 * Verify Twilio webhook signature using official Twilio library
 */
export function verifyTwilioSignature(
  signature: string,
  authToken: string,
  url: string,
  params: Record<string, any>
): boolean {
  return validateRequest(authToken, signature, url, params);
}

/**
 * Verify SendGrid webhook signature using official SendGrid library
 * Uses ECDSA (Elliptic Curve Digital Signature Algorithm)
 */
export function verifySendGridSignature(
  signature: string,
  publicKey: string,
  timestamp: string,
  payload: string
): boolean {
  try {
    const eventWebhook = new EventWebhook();
    const ecdsaPublicKey = eventWebhook.convertPublicKeyToECDSA(publicKey);
    return eventWebhook.verifySignature(ecdsaPublicKey, payload, signature, timestamp);
  } catch (error) {
    // Invalid key format or verification error
    return false;
  }
}

/**
 * Check if timestamp is within acceptable range (5 minutes)
 */
export function isTimestampValid(timestamp: string, maxAgeSeconds: number = 300): boolean {
  const currentTime = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(timestamp);
  
  return Math.abs(currentTime - requestTime) <= maxAgeSeconds;
}