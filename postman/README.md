# Postman Collection for Messaging Service API

This directory contains a comprehensive Postman collection for testing the unified messaging service API.

## Files

- `Messaging-Service-API.postman_collection.json` - Complete API collection with all endpoints
- `Local-Development.postman_environment.json` - Environment variables for local testing
- `README.md` - This documentation file

## Setup Instructions

### 1. Import the Collection

1. Open Postman
2. Click "Import" in the top left
3. Select `Messaging-Service-API.postman_collection.json`
4. The collection will appear in your sidebar

### 2. Import the Environment

1. Click the gear icon (⚙️) in the top right to manage environments
2. Click "Import" 
3. Select `Local-Development.postman_environment.json`
4. Select "Local Development" from the environment dropdown in the top right

### 3. Start Your Server

Make sure your messaging service is running:
```bash
npm run dev
# or
npm start
```

The collection assumes the server is running on `http://localhost:8080`.

## Collection Structure

### 📋 Health Check
- **GET /health** - Verify the service is running

### 📤 Message Endpoints
- **Send SMS** - Send a simple text message
- **Send MMS with Attachments** - Send message with media attachments
- **Send Email** - Send HTML email with attachments
- **Send SMS with Force Error** - Test error handling (500 error)
- **Send Email with Force Error** - Test rate limiting (429 error)

### 🔗 Webhook Endpoints
- **Inbound SMS Webhook** - Simulate receiving SMS
- **Inbound MMS Webhook** - Simulate receiving MMS with attachments
- **Inbound Email Webhook** - Simulate receiving email
- **Twilio Status Webhook - Delivered** - Update message status to delivered
- **Twilio Status Webhook - Failed** - Update message status to failed
- **SendGrid Event Webhook - Multiple Events** - Process delivery events
- **SendGrid Event Webhook - Bounce** - Process bounce events

### 💬 Conversation Endpoints
- **Get Conversations for Phone Number** - List conversations for a participant
- **Get SMS Conversations Only** - Filter by SMS channel type
- **Get Email Conversations** - Filter by EMAIL channel type
- **Get Messages for Conversation** - Retrieve all messages in a conversation

### 🚦 Rate Limiting Tests
- **Rapid SMS Requests** - Test SMS rate limiting
- **Rapid Email Requests** - Test Email rate limiting

### ❌ Error Handling Tests
- **Invalid Phone Number Format** - Test validation errors
- **Missing Required Fields** - Test missing field validation
- **Invalid Channel Type** - Test enum validation
- **Missing Participant Parameter** - Test required parameter validation

## Testing Workflows

### 1. Basic Message Flow
1. **Health Check** - Verify service is running
2. **Send SMS** - Create an outbound message
3. **Twilio Status Webhook - Delivered** - Update message status
4. **Inbound SMS Webhook** - Simulate reply
5. **Get Conversations for Phone Number** - View the conversation
6. **Get Messages for Conversation** - View all messages

### 2. Email Flow
1. **Send Email** - Send HTML email
2. **SendGrid Event Webhook - Multiple Events** - Process delivery
3. **Inbound Email Webhook** - Simulate reply
4. **Get Email Conversations** - View email conversations

### 3. Error Testing
1. **Send SMS with Force Error** - Test provider errors
2. **Invalid Phone Number Format** - Test validation
3. **Missing Required Fields** - Test required field validation

### 4. Rate Limiting
1. Use **Rapid SMS Requests** - Send multiple times quickly
2. Check response headers for rate limit information
3. Expect 429 responses when limit exceeded

## Dynamic Variables

The collection uses Postman's dynamic variables:

- `{{$isoTimestamp}}` - Current ISO timestamp
- `{{$randomAlphaNumeric}}` - Random alphanumeric string
- `{{$randomInt}}` - Random integer
- `{{$randomUUID}}` - Random UUID
- `{{$timestamp}}` - Unix timestamp

## Environment Variables

You can customize these in the Local Development environment:

- `base_url` - API base URL (default: http://localhost:8080)
- `test_phone_from` - From phone number for SMS tests
- `test_phone_to` - To phone number for SMS tests
- `test_email_from` - From email for email tests
- `test_email_to` - To email for email tests
- `conversation_id` - Set this from response to test specific conversation
- `provider_message_id` - Set this to test status updates

## Important: Phone Number URL Encoding

⚠️ **Phone numbers with `+` must be URL encoded as `%2B`**

- ✅ Correct: `%2B12345678901` 
- ❌ Incorrect: `+12345678901` (becomes a space)

The collection is pre-configured with properly encoded phone numbers. If you modify participant values in conversation endpoints, remember to encode the `+` symbol.

## Tips

1. **Run in sequence** - Some requests depend on others (e.g., status updates need message IDs)
2. **Check headers** - Rate limiting info is in response headers
3. **Use Runner** - Postman's Collection Runner can test rate limiting effectively
4. **Save responses** - Use Tests tab to extract IDs for follow-up requests
5. **Monitor console** - Check Postman console for detailed request/response info
6. **Phone numbers** - Always URL encode `+` as `%2B` in query parameters

## Webhook Authentication

If webhook authentication is enabled, you'll need to:
1. Set `SKIP_WEBHOOK_AUTH=true` in your .env file, OR
2. Configure proper webhook signatures (see main project documentation)

For development testing, it's recommended to disable webhook auth by setting `SKIP_WEBHOOK_AUTH=true`.

## Rate Limiting Configuration

Default rate limits (can be changed via environment variables):
- SMS: 100 requests per minute
- Email: 500 requests per minute

Set `SMS_RATE_LIMIT` and `EMAIL_RATE_LIMIT` in your .env file to customize.