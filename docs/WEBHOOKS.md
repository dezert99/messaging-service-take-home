# Webhook Testing and Implementation Guide

## Overview

The Messaging Service supports webhooks for receiving inbound messages and status updates from SMS/MMS and Email providers. This guide covers webhook implementation, testing, and signature verification.

## Webhook Endpoints

### Inbound Message Webhooks

| Endpoint | Provider | Purpose |
|----------|----------|---------|
| `POST /api/webhooks/sms` | Twilio-like | Receive inbound SMS/MMS |
| `POST /api/webhooks/email` | SendGrid-like | Receive inbound emails |

### Status Update Webhooks

| Endpoint | Provider | Purpose |
|----------|----------|---------|
| `POST /api/webhooks/sms/status` | Twilio | Message delivery status |
| `POST /api/webhooks/email/events` | SendGrid | Email events (delivered, bounced, etc.) |

## Webhook Payloads

### Inbound SMS/MMS Payload

```json
{
  "from": "+19876543210",
  "to": "+12345678901", 
  "type": "sms",
  "messaging_provider_id": "SM1234567890abcdef1234567890abcdef",
  "body": "Hello! This is an inbound message.",
  "attachments": ["https://example.com/image.jpg"],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Fields:**
- `from`: Sender phone number (E.164 format)
- `to`: Recipient phone number (E.164 format)
- `type`: "sms" or "mms"
- `messaging_provider_id`: Provider's unique message ID
- `body`: Message content
- `attachments`: Array of attachment URLs (null for SMS)
- `timestamp`: ISO 8601 timestamp

### Inbound Email Payload

```json
{
  "from": "customer@example.com",
  "to": "support@company.com",
  "xillio_id": "abc123def456.filter001.1642248600.0",
  "body": "<p>I need help with my account.</p>",
  "attachments": ["https://example.com/document.pdf"],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Fields:**
- `from`: Sender email address
- `to`: Recipient email address  
- `xillio_id`: Provider's unique message ID
- `body`: Email content (HTML)
- `attachments`: Array of attachment URLs
- `timestamp`: ISO 8601 timestamp

### Twilio Status Update Payload

```json
{
  "MessageSid": "SM1234567890abcdef1234567890abcdef",
  "MessageStatus": "delivered",
  "AccountSid": "AC1234567890abcdef1234567890abcdef",
  "From": "+12345678901",
  "To": "+19876543210",
  "ApiVersion": "2010-04-01",
  "ErrorCode": "30008",
  "ErrorMessage": "Unknown error"
}
```

**Required Fields:**
- `MessageSid`: Twilio message SID
- `MessageStatus`: "queued", "sent", "delivered", "failed", "undelivered"
- `AccountSid`: Twilio account SID
- `From`: Sender phone number
- `To`: Recipient phone number
- `ApiVersion`: Twilio API version

**Optional Fields:**
- `ErrorCode`: Error code (when status is "failed")
- `ErrorMessage`: Error description

### SendGrid Events Payload

**Note:** SendGrid sends events as an array.

```json
[
  {
    "email": "recipient@example.com",
    "timestamp": 1642248600,
    "smtp-id": "<test.123@example.com>",
    "event": "delivered",
    "sg_event_id": "sg_event_123456789",
    "sg_message_id": "abc123def456.filter001.1642248600.0",
    "category": ["newsletter"],
    "reason": "550 5.1.1 User unknown"
  }
]
```

**Fields:**
- `email`: Recipient email address
- `timestamp`: Unix timestamp
- `smtp-id`: SMTP message ID
- `event`: Event type (processed, delivered, bounce, open, click, etc.)
- `sg_event_id`: Unique event ID (for deduplication)
- `sg_message_id`: SendGrid message ID
- `category`: Event categories (optional)
- `reason`: Bounce/failure reason (for bounce events)

## Testing Webhooks

### Manual Testing Scripts

The project includes comprehensive webhook testing scripts in `tests/manual/webhook-tests/`:

```bash
# Test inbound SMS
./tests/manual/webhook-tests/test-inbound-sms.sh

# Test inbound MMS
./tests/manual/webhook-tests/test-inbound-mms.sh

# Test inbound email
./tests/manual/webhook-tests/test-inbound-email.sh

# Test Twilio status updates
./tests/manual/webhook-tests/test-twilio-status.sh

# Test SendGrid events
./tests/manual/webhook-tests/test-sendgrid-events.sh

# Full workflow test
./tests/manual/webhook-tests/full-workflow-test.sh
```

### Example Manual Tests

#### Test Inbound SMS

```bash
curl -X POST http://localhost:8080/api/webhooks/sms \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "+19876543210",
    "to": "+12345678901",
    "type": "sms", 
    "messaging_provider_id": "SM'$(date +%s)'",
    "body": "Hello from webhook test!",
    "attachments": null,
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

#### Test Inbound Email

```bash
curl -X POST http://localhost:8080/api/webhooks/email \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "customer@example.com",
    "to": "support@company.com",
    "xillio_id": "'$(date +%s)'.filter001.'$(date +%s)'.0",
    "body": "<p>Test email from webhook!</p>",
    "attachments": ["https://example.com/test.pdf"],
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

#### Test Status Update

```bash
curl -X POST http://localhost:8080/api/webhooks/sms/status \\
  -H "Content-Type: application/json" \\
  -d '{
    "MessageSid": "SM1234567890abcdef1234567890abcdef",
    "MessageStatus": "delivered",
    "AccountSid": "AC1234567890abcdef1234567890abcdef", 
    "From": "+12345678901",
    "To": "+19876543210",
    "ApiVersion": "2010-04-01"
  }'
```

## Webhook Signature Verification

### Development Mode

For development and testing, set `SKIP_WEBHOOK_AUTH=true` in your `.env` file to disable signature verification.

### Production Configuration

#### Twilio Webhook Verification

1. Set your Twilio Auth Token:
```bash
TWILIO_AUTH_TOKEN=your_actual_auth_token_here
```

2. Configure Twilio webhook URL in your Twilio console:
```
https://yourdomain.com/api/webhooks/sms
https://yourdomain.com/api/webhooks/sms/status
```

#### SendGrid Webhook Verification

1. Generate an ECDSA public/private key pair for webhook verification
2. Configure the public key in your SendGrid account
3. Set the public key in your environment:
```bash
SENDGRID_WEBHOOK_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...
-----END PUBLIC KEY-----"
```

4. Configure SendGrid webhook URLs:
```
https://yourdomain.com/api/webhooks/email
https://yourdomain.com/api/webhooks/email/events
```

### Signature Generation for Testing

Use the provided script to generate test signatures:

```bash
# Generate Twilio signature
node tests/manual/webhook-tests/generate-signatures.ts twilio

# Generate SendGrid signature  
node tests/manual/webhook-tests/generate-signatures.ts sendgrid
```

## Webhook Behavior

### Response Handling

- **Always return 200 OK** - Even for errors, webhooks should return 200 to prevent retries
- **Idempotent processing** - Duplicate webhooks are automatically detected and ignored
- **Error logging** - All webhook errors are logged with correlation IDs

### Duplicate Prevention

The service automatically prevents duplicate webhook processing:

- **SMS/MMS**: Deduplication by `messaging_provider_id`
- **Email**: Deduplication by `xillio_id`  
- **SendGrid Events**: Deduplication by `sg_event_id` using `ProcessedEvent` table

### Conversation Management

Inbound webhooks automatically:
- Create conversations if they don't exist
- Link messages to existing conversations based on participants
- Update conversation `lastMessageAt` timestamp
- Normalize participant ordering for consistent lookups

### Status Mapping

Status updates from providers are mapped to internal statuses:

**Twilio Status Mapping:**
- `queued` → `PENDING`
- `sent` → `SENT`
- `delivered` → `DELIVERED`
- `failed`/`undelivered` → `FAILED`

**SendGrid Event Mapping:**
- `processed` → `SENT`
- `delivered` → `DELIVERED`
- `bounce`/`dropped` → `FAILED`

## Integration Testing

### Automated Tests

Run the comprehensive webhook test suite:

```bash
# Run all webhook tests
npm test tests/api/webhooks.test.ts

# Run specific webhook test
npm test -- --testNamePattern="should process inbound SMS"
```

### End-to-End Testing

1. **Send outbound message** via API
2. **Simulate inbound response** via webhook
3. **Check status updates** via status webhook
4. **Verify conversation** via conversation API

```bash
# Run full workflow test
./tests/manual/webhook-tests/full-workflow-test.sh
```

## Troubleshooting

### Common Issues

**Webhook not received:**
- Check server is running on correct port
- Verify webhook URL is publicly accessible
- Check firewall/NAT configuration

**Signature verification failing:**
- Ensure `SKIP_WEBHOOK_AUTH=false` for production
- Verify webhook secrets are correctly configured
- Check timestamp tolerance for SendGrid (within 10 minutes)

**Duplicate messages:**
- Verify provider message IDs are unique
- Check database constraints on provider message ID

**Status updates not working:**
- Ensure message exists before status update
- Verify provider message ID matches exactly
- Check status mapping logic

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm start
```

### Health Check

Verify webhook endpoints are responding:

```bash
curl -X GET http://localhost:8080/health
```

## Production Deployment

### Security Checklist

- [ ] Set `SKIP_WEBHOOK_AUTH=false`
- [ ] Configure real webhook secrets
- [ ] Use HTTPS for all webhook URLs
- [ ] Set up proper firewall rules
- [ ] Configure webhook URL allowlists in provider dashboards
- [ ] Monitor webhook failure rates
- [ ] Set up alerting for webhook errors

### Monitoring

Key metrics to monitor:
- Webhook success/failure rates
- Webhook processing latency
- Duplicate webhook attempts
- Signature verification failures
- Message delivery rates