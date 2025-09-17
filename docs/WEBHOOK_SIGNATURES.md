# Webhook Signature Verification

This document explains how webhook signature verification works for Twilio and SendGrid webhooks.

## Overview

Webhook signatures ensure that incoming webhooks are actually from the expected providers and haven't been tampered with. This service supports signature verification for:

- **Twilio** (SMS/MMS webhooks) - Uses HMAC-SHA1
- **SendGrid** (Email event webhooks) - Uses HMAC-SHA256

## Configuration

Set these environment variables to enable signature verification:

```bash
# Disable verification for development/testing
SKIP_WEBHOOK_AUTH=true

# Production webhook secrets
TWILIO_AUTH_TOKEN=your_twilio_auth_token
SENDGRID_WEBHOOK_PUBLIC_KEY=your_sendgrid_ecdsa_public_key
```

## Twilio Signature Verification

### Implementation

This service uses the **official Twilio library** for webhook signature verification, which provides a robust and well-tested implementation.

```typescript
import { validateRequest } from 'twilio';

function verifyTwilioSignature(
  signature: string,
  authToken: string, 
  url: string,
  params: Record<string, any>
): boolean {
  return validateRequest(authToken, signature, url, params);
}
```

### How Twilio Signatures Work

The Twilio library handles the complete signature verification process:

1. **Parameter sorting**: Sorts all POST parameters alphabetically
2. **URL concatenation**: Combines the webhook URL with sorted parameters
3. **HMAC-SHA1**: Creates HMAC-SHA1 hash using your Auth Token
4. **Base64 encoding**: Encodes the result as base64
5. **Comparison**: Securely compares signatures to prevent timing attacks

### Example Verification Process

```
URL: https://example.com/api/webhooks/sms/status
Parameters: { MessageSid: "SM123", MessageStatus: "delivered", AccountSid: "AC456" }

The Twilio library automatically:
- Sorts parameters: AccountSid, MessageSid, MessageStatus
- Concatenates: https://example.com/api/webhooks/sms/statusAccountSidAC456MessageSidSM123MessageStatusdelivered
- Generates HMAC-SHA1 with your auth token
- Returns true/false for signature match
```

### Headers

Twilio sends the signature in the `X-Twilio-Signature` header.

### Benefits of Official Library

- ✅ **Maintained by Twilio** - Always up-to-date with any changes
- ✅ **Handles edge cases** - Properly deals with encoding and special characters  
- ✅ **Security best practices** - Includes timing attack protections
- ✅ **Thoroughly tested** - Battle-tested in production environments

## SendGrid Signature Verification

### Implementation

This service uses the **official SendGrid library** (`@sendgrid/eventwebhook`) for ECDSA signature verification.

```typescript
import { EventWebhook } from '@sendgrid/eventwebhook';

function verifySendGridSignature(
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
    return false;
  }
}
```

### How SendGrid ECDSA Signatures Work

SendGrid now uses **ECDSA (Elliptic Curve Digital Signature Algorithm)** for webhook security:

1. **Key Generation**: SendGrid generates a private/public ECDSA key pair
2. **Signature Creation**: Uses the private key to sign the webhook payload
3. **Verification**: You verify using the public key provided by SendGrid
4. **Raw Payload**: Signature is computed on the raw bytes, not parsed JSON

### IMPORTANT: Raw Payload Requirement

⚠️ **Critical**: SendGrid ECDSA verification requires the **raw payload bytes**, not parsed JSON:

```javascript
// ❌ WRONG - This will fail verification
const payload = JSON.stringify(req.body);

// ✅ CORRECT - Use raw request body
const payload = req.rawBody; // or raw string/buffer
```

### Headers

SendGrid sends these headers:
- `X-Twilio-Email-Event-Webhook-Signature`: The ECDSA signature
- `X-Twilio-Email-Event-Webhook-Timestamp`: Unix timestamp

### Configuration

Use the **public key** (not a secret key) from your SendGrid dashboard:

```bash
# Get this from SendGrid Dashboard → Settings → Mail Settings → Event Webhook
SENDGRID_WEBHOOK_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...
-----END PUBLIC KEY-----"
```

### Benefits of Official Library

- ✅ **ECDSA Support** - Handles modern elliptic curve cryptography
- ✅ **Key Conversion** - Automatically converts public key to ECDSA format
- ✅ **Maintained by SendGrid** - Always up-to-date with their security practices
- ✅ **Raw Payload Handling** - Properly handles the byte-level verification requirements

### Timestamp Validation

SendGrid signatures include timestamp validation to prevent replay attacks. Requests older than 5 minutes are rejected.

## Testing Signature Verification

### Enable Verification for Testing

1. Set webhook secrets in your environment:
   ```bash
   SKIP_WEBHOOK_AUTH=false
   TWILIO_AUTH_TOKEN=test_auth_token_123
   SENDGRID_WEBHOOK_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...\n-----END PUBLIC KEY-----"
   ```

2. Generate valid signatures for your test requests

### Generate Test Signatures

Use the official libraries to generate valid signatures:

```typescript
import { validateRequest } from 'twilio';
import { generateSendGridSignature } from '../src/utils/crypto';

// For Twilio: Use their webhook utility to generate signatures
// (Note: Twilio library is primarily for validation, not generation)
// For testing, you can use curl with real Twilio webhooks or mock the signature

// SendGrid signature  
const timestamp = Math.floor(Date.now() / 1000).toString();
const payload = JSON.stringify([{ email: 'test@example.com', event: 'delivered' }]);
const sendGridSig = generateSendGridSignature(
  'test_verification_key_456',
  timestamp,
  payload
);

// For Twilio testing, you can create a simple generator:
import crypto from 'crypto';

function generateTwilioTestSignature(authToken: string, url: string, params: Record<string, any>): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
    
  return crypto
    .createHmac('sha1', authToken)
    .update(data)
    .digest('base64');
}
```

### Test with curl

```bash
# Twilio webhook with signature
curl -X POST http://localhost:8080/api/webhooks/sms/status \
  -H "Content-Type: application/json" \
  -H "X-Twilio-Signature: GENERATED_SIGNATURE_HERE" \
  -d '{"MessageSid":"SM123","MessageStatus":"delivered"}'

# SendGrid webhook with signature
curl -X POST http://localhost:8080/api/webhooks/email/events \
  -H "Content-Type: application/json" \
  -H "X-Twilio-Email-Event-Webhook-Signature: GENERATED_SIGNATURE_HERE" \
  -H "X-Twilio-Email-Event-Webhook-Timestamp: TIMESTAMP_HERE" \
  -d '[{"email":"test@example.com","event":"delivered"}]'
```

## Security Considerations

### Production Setup

1. **Always enable signature verification in production**:
   ```bash
   SKIP_WEBHOOK_AUTH=false
   ```

2. **Use strong, unique secrets** for each provider

3. **Rotate secrets periodically** and update webhook configurations

4. **Monitor failed signature verifications** - these may indicate attacks

### Common Issues

1. **URL mismatch**: Ensure the webhook URL in your provider settings exactly matches what your server receives
2. **Parameter encoding**: Twilio uses form-encoded parameters, ensure proper parsing
3. **Timestamp drift**: SendGrid rejects requests with timestamps more than 5 minutes old
4. **Proxy headers**: When behind a proxy, ensure `X-Forwarded-Proto` and `X-Forwarded-Host` headers are set correctly

### Logging

The webhook auth middleware logs detailed information for debugging:

- **Debug level**: Successful verifications and skip reasons
- **Warn level**: Failed verifications with details
- **Error level**: Unexpected errors during verification

## Development vs Production

### Development (Default)
- `SKIP_WEBHOOK_AUTH=true` - Signatures are not verified
- Webhooks work without valid signatures
- Useful for testing with curl/Postman

### Production
- `SKIP_WEBHOOK_AUTH=false` or unset
- All webhooks must have valid signatures
- Invalid signatures return HTTP 401

This flexible approach allows easy development while ensuring production security.