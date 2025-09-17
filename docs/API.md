# Messaging Service API Documentation

## Overview

The Messaging Service provides a unified API for sending and receiving messages through SMS/MMS and Email providers. It features automatic conversation management, webhook handling, and rate limiting.

## Base URL

```
http://localhost:8080/api
```

## Authentication

Currently, the API does not require authentication for message endpoints. Webhook endpoints support optional signature verification.

## Rate Limiting

The API implements rate limiting with the following default limits:
- SMS/MMS: 100 requests per minute
- Email: 500 requests per minute

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Timestamp when the window resets
- `Retry-After`: Seconds to wait when rate limited (429 responses only)

## Message Endpoints

### Send SMS Message

Send an SMS or MMS message.

**Endpoint:** `POST /api/messages/sms`

**Request Body:**
```json
{
  "from": "+12345678901",
  "to": "+19876543210",
  "type": "sms",
  "body": "Hello, this is a test SMS message!",
  "attachments": [],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Request Fields:**
- `from` (string, required): Sender phone number in E.164 format
- `to` (string, required): Recipient phone number in E.164 format  
- `type` (string, required): Message type ("sms" or "mms")
- `body` (string, required): Message content (max 1600 characters)
- `attachments` (array, optional): Array of attachment URLs (makes it MMS)
- `timestamp` (string, required): ISO 8601 timestamp
- `_forceError` (object, optional): Force error for testing

**Response (201 Created):**
```json
{
  "success": true,
  "message": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "conversationId": "550e8400-e29b-41d4-a716-446655440001",
    "from": "+12345678901",
    "to": "+19876543210",
    "type": "SMS",
    "body": "Hello, this is a test SMS message!",
    "attachments": [],
    "status": "SENT",
    "timestamp": "2024-01-15T10:30:00Z",
    "providerMessageId": "SM1234567890abcdef1234567890abcdef"
  },
  "provider": {
    "sid": "SM1234567890abcdef1234567890abcdef",
    "status": "queued",
    "uri": "/2010-04-01/Accounts/AC.../Messages/SM....json"
  }
}
```

### Send Email Message

Send an email message.

**Endpoint:** `POST /api/messages/email`

**Request Body:**
```json
{
  "from": "sender@example.com",
  "to": "recipient@example.com",
  "body": "<p>Hello, this is a test email!</p>",
  "attachments": ["https://example.com/document.pdf"],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Request Fields:**
- `from` (string, required): Sender email address
- `to` (string, required): Recipient email address
- `body` (string, required): Email content (HTML supported)
- `attachments` (array, optional): Array of attachment URLs
- `timestamp` (string, required): ISO 8601 timestamp
- `_forceError` (object, optional): Force error for testing

**Response (201 Created):**
```json
{
  "success": true,
  "message": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "conversationId": "550e8400-e29b-41d4-a716-446655440001",
    "from": "sender@example.com",
    "to": "recipient@example.com",
    "type": "EMAIL",
    "body": "<p>Hello, this is a test email!</p>",
    "attachments": ["https://example.com/document.pdf"],
    "status": "SENT",
    "timestamp": "2024-01-15T10:30:00Z",
    "providerMessageId": "abc123def456.filter001.1642248600.0"
  },
  "provider": {
    "statusCode": 202,
    "message_id": "abc123def456.filter001.1642248600.0"
  }
}
```

## Conversation Endpoints

### List Conversations

Get conversations for a specific participant.

**Endpoint:** `GET /api/conversations`

**Query Parameters:**
- `participant` (string, required): Phone number or email address
- `channelType` (string, optional): Filter by "SMS" or "EMAIL"
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)

**Example:**
```
GET /api/conversations?participant=%2B12345678901&channelType=SMS&page=1&limit=10
```

**Response (200 OK):**
```json
{
  "conversations": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "participant1": "+12345678901",
      "participant2": "+19876543210", 
      "channelType": "SMS",
      "lastMessageAt": "2024-01-15T10:30:00Z",
      "messageCount": 5,
      "lastMessage": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "from": "+19876543210",
        "to": "+12345678901",
        "type": "SMS",
        "body": "Thanks for the update!",
        "direction": "INBOUND",
        "status": "RECEIVED",
        "timestamp": "2024-01-15T10:30:00Z"
      },
      "createdAt": "2024-01-15T09:00:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "hasMore": false
  },
  "filters": {
    "participant": "+12345678901",
    "channelType": "SMS"
  }
}
```

### Get Conversation Messages

Get all messages in a specific conversation.

**Endpoint:** `GET /api/conversations/:id/messages`

**Path Parameters:**
- `id` (string, required): Conversation UUID

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 50, max: 100)

**Example:**
```
GET /api/conversations/550e8400-e29b-41d4-a716-446655440001/messages?page=1&limit=20
```

**Response (200 OK):**
```json
{
  "conversation": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "participant1": "+12345678901",
    "participant2": "+19876543210",
    "channelType": "SMS",
    "lastMessageAt": "2024-01-15T10:30:00Z",
    "messageCount": 5,
    "createdAt": "2024-01-15T09:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "messages": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "from": "+12345678901",
      "to": "+19876543210",
      "type": "SMS",
      "body": "Hello, how are you?",
      "attachments": [],
      "direction": "OUTBOUND",
      "status": "DELIVERED",
      "providerMessageId": "SM1234567890abcdef1234567890abcdef",
      "provider": "twilio",
      "timestamp": "2024-01-15T09:00:00Z",
      "createdAt": "2024-01-15T09:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "hasMore": false
  }
}
```

## Webhook Endpoints

### Inbound SMS/MMS Webhook

Receive inbound SMS/MMS messages from Twilio-like providers.

**Endpoint:** `POST /api/webhooks/sms`

**Request Body:**
```json
{
  "from": "+19876543210",
  "to": "+12345678901",
  "type": "sms",
  "messaging_provider_id": "SM1234567890abcdef1234567890abcdef",
  "body": "Hello! This is an inbound message.",
  "attachments": null,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response (200 OK):**
```
OK
```

### Inbound Email Webhook

Receive inbound email messages from SendGrid-like providers.

**Endpoint:** `POST /api/webhooks/email`

**Request Body:**
```json
{
  "from": "customer@example.com",
  "to": "support@company.com",
  "xillio_id": "abc123def456.filter001.1642248600.0",
  "body": "<p>I need help with my account.</p>",
  "attachments": ["https://example.com/screenshot.png"],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response (200 OK):**
```
OK
```

### Twilio Status Webhook

Receive message status updates from Twilio.

**Endpoint:** `POST /api/webhooks/sms/status`

**Request Body:**
```json
{
  "MessageSid": "SM1234567890abcdef1234567890abcdef",
  "MessageStatus": "delivered",
  "AccountSid": "AC1234567890abcdef1234567890abcdef",
  "From": "+12345678901",
  "To": "+19876543210",
  "ApiVersion": "2010-04-01"
}
```

**Response (200 OK):**
```
OK
```

### SendGrid Events Webhook

Receive email event updates from SendGrid.

**Endpoint:** `POST /api/webhooks/email/events`

**Request Body:**
```json
[
  {
    "email": "recipient@example.com",
    "timestamp": 1642248600,
    "smtp-id": "<test.123@example.com>",
    "event": "delivered",
    "sg_event_id": "sg_event_123456789",
    "sg_message_id": "abc123def456.filter001.1642248600.0"
  }
]
```

**Response (200 OK):**
```
OK
```

## Error Responses

### Validation Error (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed: From field is required",
    "correlationId": "err_1642248600_abc123"
  }
}
```

### Rate Limit Error (429)

```json
{
  "error": "SMS rate limit exceeded. Please retry after some time.",
  "retryAfter": 30
}
```

### Server Error (500)

```json
{
  "error": {
    "code": "INTERNAL_ERROR", 
    "message": "An unexpected error occurred",
    "correlationId": "err_1642248600_def456"
  }
}
```

## Message Types and Statuses

### Message Types
- `SMS`: Text-only message
- `MMS`: Message with attachments  
- `EMAIL`: Email message

### Message Statuses
- `PENDING`: Outbound message created but not sent
- `SENT`: Successfully sent to provider
- `DELIVERED`: Provider confirmed delivery
- `FAILED`: Provider returned error
- `RECEIVED`: Inbound message received via webhook

### Message Directions
- `OUTBOUND`: Sent via API
- `INBOUND`: Received via webhook

## Force Error Testing

For testing purposes, you can force errors by including a `_forceError` field in the request:

```json
{
  "from": "+12345678901",
  "to": "+19876543210", 
  "type": "sms",
  "body": "Test message",
  "timestamp": "2024-01-15T10:30:00Z",
  "_forceError": {
    "code": 500,
    "message": "Simulated provider error"
  }
}
```

Supported error codes: 400, 429, 500, 503

## Health Check

**Endpoint:** `GET /health`

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z"
}
```