/**
 * Utility to generate webhook signatures for testing
 * Run with: npx ts-node tests/manual/webhook-tests/generate-signatures.ts
 */

import crypto from 'crypto';

// Generate Twilio signature for testing (same algorithm as Twilio uses)
function generateTwilioSignature(authToken: string, url: string, params: Record<string, any>): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
    
  return crypto
    .createHmac('sha1', authToken)
    .update(data)
    .digest('base64');
}

// NOTE: SendGrid now uses ECDSA signatures which require a private key
// For testing ECDSA verification, you need:
// 1. A real SendGrid public/private key pair from your SendGrid dashboard
// 2. Or mock the verification by setting SKIP_WEBHOOK_AUTH=true
function generateSendGridECDSANote(): string {
  return `
⚠️  SendGrid now uses ECDSA signatures (not HMAC)!

To test SendGrid webhooks:
1. Set SKIP_WEBHOOK_AUTH=true in .env (easiest for development)
2. Or get real ECDSA keys from SendGrid dashboard
3. Use the @sendgrid/eventwebhook library to generate signatures

ECDSA requires a private key to generate signatures,
which you get from SendGrid's dashboard, not this script.
`;
}

// Example usage
function generateTestSignatures() {
  console.log('🔐 Webhook Signature Generator');
  console.log('==============================\n');

  // Test credentials (use these in your .env for testing)
  const twilioAuthToken = 'test_auth_token_123456789abcdef';
  
  console.log('Test credentials to use in .env:');
  console.log(`TWILIO_AUTH_TOKEN=${twilioAuthToken}`);
  console.log('SKIP_WEBHOOK_AUTH=true  # Easiest for SendGrid testing\n');

  // Twilio SMS status webhook example
  const twilioUrl = 'http://localhost:8080/api/webhooks/sms/status';
  const twilioParams = {
    MessageSid: 'SM1234567890abcdef',
    MessageStatus: 'delivered',
    AccountSid: 'ACmock1234567890abcdef1234567890',
    From: '+12345678901',
    To: '+19876543210',
    ApiVersion: '2010-04-01'
  };

  const twilioSig = generateTwilioSignature(twilioAuthToken, twilioUrl, twilioParams);
  
  console.log('📱 Twilio Status Webhook Test:');
  console.log('curl -X POST http://localhost:8080/api/webhooks/sms/status \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log(`  -H "X-Twilio-Signature: ${twilioSig}" \\`);
  console.log(`  -d '${JSON.stringify(twilioParams)}'`);
  console.log('');

  console.log(generateSendGridECDSANote());
  
  console.log('📧 SendGrid Events Webhook Test (with auth disabled):');
  console.log('curl -X POST http://localhost:8080/api/webhooks/email/events \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'[{"email":"test@example.com","timestamp":'+ Math.floor(Date.now() / 1000) +',"event":"delivered","sg_event_id":"event_'+ Date.now() +'","sg_message_id":"email_'+ Date.now() +'"}]\'');
  console.log('');

  console.log('💡 Tips:');
  console.log('- Make sure to set SKIP_WEBHOOK_AUTH=false in your .env');
  console.log('- Use the exact test credentials shown above');
  console.log('- The signatures are only valid for the exact URLs and payloads shown');
  console.log('- For different URLs/data, regenerate signatures with this script');
}

generateTestSignatures();

export { generateTwilioSignature };