Messaging Service Implementation Guide
Project Overview
Build an HTTP messaging service that provides a unified API for sending and receiving messages through SMS/MMS and Email providers. The service simulates integration with Twilio (SMS/MMS) and SendGrid (Email) while managing conversations and storing messages in PostgreSQL.
Key Requirements:

Unified messaging API supporting SMS, MMS, and Email
Automatic conversation management based on participants
Webhook handling for inbound messages and status updates
Rate limiting with configurable thresholds
Mock provider implementations with forced error support
Webhook signature verification
PostgreSQL with Prisma ORM

Tech Stack

Runtime: Node.js with TypeScript
Framework: Express.js
Database: PostgreSQL with Prisma ORM
Testing: Jest with Supertest
Validation: Joi or Zod
Logging: Winston or Pino

Database Schema
prisma// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Conversation {
  id            String      @id @default(uuid())
  participant1  String      // Always lexicographically first
  participant2  String      // Always lexicographically second
  channelType   ChannelType
  lastMessageAt DateTime
  messages      Message[]
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  
  @@unique([participant1, participant2, channelType])
  @@index([participant1, participant2, channelType])
  @@index([participant1, channelType])
  @@index([participant2, channelType])
  @@index([lastMessageAt])
}

model Message {
  id                 String           @id @default(uuid())
  conversationId     String
  conversation       Conversation     @relation(fields: [conversationId], references: [id])
  from              String
  to                String
  type              MessageType      // SMS, MMS, or EMAIL
  body              String           // Text for SMS/MMS, HTML for email
  attachments       String[]         // Array of URLs
  direction         MessageDirection // INBOUND or OUTBOUND
  status            MessageStatus    // PENDING, SENT, DELIVERED, FAILED, RECEIVED
  providerMessageId String?          // messaging_provider_id for SMS/MMS, xillio_id for email
  provider          String?          // "twilio" or "sendgrid"
  metadata          Json?            // For error codes, retry counts, etc.
  timestamp         DateTime         // From the payload
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
  
  @@index([conversationId])
  @@index([from, to])
  @@index([providerMessageId])
  @@index([timestamp])
}

model ProcessedEvent {
  id          String   @id // sg_event_id
  processedAt DateTime @default(now())
  
  @@index([processedAt])
}

enum ChannelType {
  SMS    // Covers both SMS and MMS
  EMAIL
}

enum MessageType {
  SMS    // Text only
  MMS    // Text with attachments
  EMAIL
}

enum MessageDirection {
  INBOUND
  OUTBOUND
}

enum MessageStatus {
  PENDING    // Outbound message created but not sent
  SENT       // Successfully sent to provider
  DELIVERED  // Provider confirmed delivery
  FAILED     // Provider returned error
  RECEIVED   // Inbound message received via webhook
}
API Endpoints
POST /api/messages/sms     - Send SMS/MMS
POST /api/messages/email   - Send Email

POST /api/webhooks/sms     - Receive inbound SMS/MMS
POST /api/webhooks/email   - Receive inbound emails
POST /api/webhooks/sms/status    - Twilio status updates
POST /api/webhooks/email/events  - SendGrid event updates

GET /api/conversations     - List conversations
GET /api/conversations/:id/messages - Get messages in conversation

GET /health               - Health check endpoint
Project Structure
messaging-service-take-home/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app.ts                 # Express app setup
│   ├── server.ts              # Server entry point
│   ├── config/
│   │   └── rateLimits.ts
│   ├── controllers/
│   │   ├── messageController.ts
│   │   ├── webhookController.ts
│   │   └── conversationController.ts
│   ├── lib/
│   │   └── prisma.ts
│   ├── middleware/
│   │   ├── errorHandler.ts
│   │   ├── rateLimiter.ts
│   │   ├── requestLogger.ts
│   │   ├── validation.ts
│   │   └── webhookAuth.ts
│   ├── providers/
│   │   ├── interfaces.ts
│   │   ├── MockSmsProvider.ts
│   │   └── MockEmailProvider.ts
│   ├── routes/
│   │   ├── messages.ts
│   │   ├── webhooks.ts
│   │   └── conversations.ts
│   ├── services/
│   │   ├── messageService.ts
│   │   └── conversationService.ts
│   ├── types/
│   │   ├── requests.ts
│   │   └── webhooks.ts
│   └── utils/
│       ├── crypto.ts
│       ├── errors.ts
│       ├── logger.ts
│       ├── participants.ts
│       └── statusMapping.ts
├── scripts/
│   └── test-rate-limit.js
├── tests/
│   └── api/
│       ├── messages.test.ts
│       ├── webhooks.test.ts
│       ├── conversations.test.ts
│       └── rateLimiting.test.ts
├── docs/
│   ├── API.md
│   ├── WEBHOOKS.md
│   └── RATE_LIMITING.md
├── .env.example
├── .gitignore
├── jest.config.js
├── package.json
└── tsconfig.json
Key Implementation Details
Conversation Management
Conversations are uniquely identified by:

Participants - Stored as participant1 and participant2 (always sorted lexicographically)
Channel Type - SMS (covers SMS/MMS) or EMAIL

Participant Normalization:
typescriptfunction normalizeParticipants(from: string, to: string): [string, string] {
  return from < to ? [from, to] : [to, from];
}
This ensures bidirectional messages (A→B and B→A) belong to the same conversation.
Message Type Determination
typescriptfunction determineMessageType(payload: any): MessageType {
  if (payload.type === 'email' || payload.from.includes('@')) {
    return MessageType.EMAIL;
  } else if (payload.type === 'mms' || (payload.attachments && payload.attachments.length > 0)) {
    return MessageType.MMS;
  } else {
    return MessageType.SMS;
  }
}
Rate Limiting Configuration
Implement token bucket algorithm with separate limits for SMS and Email:
typescriptconst rateLimits = {
  sms: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 100,     // 100 requests per minute
    message: 'SMS rate limit exceeded'
  },
  email: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 500,     // 500 requests per minute
    message: 'Email rate limit exceeded'
  }
}
Response headers must include:

X-RateLimit-Limit
X-RateLimit-Remaining
X-RateLimit-Reset
Retry-After (when rate limited)

Mock Provider Specifications
SMS/MMS Provider (Twilio-like)
Message ID Format: SM{32-char-hex} for SMS, MM{32-char-hex} for MMS
Response Structure:
typescript{
  sid: string,
  account_sid: string,
  from: string,
  to: string,
  body: string,
  status: 'queued' | 'sent' | 'failed',
  num_segments: string,
  direction: 'outbound-api',
  price: string,
  price_unit: 'USD',
  date_created: string,
  date_updated: string,
  uri: string
}
Email Provider (SendGrid-like)
Message ID Format: {16-char-hex}.filter001.{timestamp}.0
Response Structure:
typescript{
  statusCode: 202,
  message_id: string,
  body: null
}
Force Error Support
Both SMS and Email endpoints accept optional _forceError field:
typescript{
  // ... regular payload fields
  _forceError?: {
    code: 429 | 500 | 400 | 503,
    message?: string
  }
}
Webhook Payload Formats
Inbound SMS/MMS (from README)
typescript{
  from: string,
  to: string,
  type: 'sms' | 'mms',
  messaging_provider_id: string,
  body: string,
  attachments?: string[] | null,
  timestamp: string
}
Inbound Email (from README)
typescript{
  from: string,
  to: string,
  xillio_id: string,
  body: string,  // HTML content
  attachments?: string[],
  timestamp: string
}
Twilio Status Webhook (exact field names)
typescript{
  MessageSid: string,
  MessageStatus: 'queued' | 'failed' | 'sent' | 'delivered' | 'undelivered',
  AccountSid: string,
  From: string,
  To: string,
  ApiVersion: string,
  ErrorCode?: string,
  ErrorMessage?: string,
  // ... additional optional fields
}
SendGrid Event Webhook (array of events)
typescript[{
  email: string,
  timestamp: number,
  'smtp-id': string,
  event: 'processed' | 'delivered' | 'bounce' | 'open' | 'click' | etc,
  sg_event_id: string,    // For deduplication
  sg_message_id: string,
  // ... additional event-specific fields
}]
Webhook Signature Verification
Twilio Signature (HMAC-SHA1)
typescriptconst params = Object.keys(req.body)
  .sort()
  .reduce((acc, key) => acc + key + req.body[key], url);

const expectedSignature = crypto
  .createHmac('sha1', process.env.TWILIO_AUTH_TOKEN)
  .update(params)
  .digest('base64');
SendGrid Signature (HMAC-SHA256)
typescriptconst payload = timestamp + JSON.stringify(req.body);
const expectedSignature = crypto
  .createHmac('sha256', process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY)
  .update(payload)
  .digest('hex');
Environment Variables
bash# Database
DATABASE_URL="postgresql://messaging_user:messaging_password@localhost:5432/messaging_service"

# Server
PORT=8080
NODE_ENV=development

# Rate Limiting
SMS_RATE_LIMIT=100     # requests per minute
EMAIL_RATE_LIMIT=500   # requests per minute

# Logging
LOG_LEVEL=info

Testing Requirements
The implementation must pass all scenarios in bin/test.sh:

Send SMS
Send MMS (with attachments)
Send Email (with HTML)
Receive SMS webhook
Receive MMS webhook
Receive Email webhook
Get conversations
Get messages for conversation

Additional testing requirements:

Rate limiting behavior
Force error functionality
Webhook signature verification
Conversation grouping logic

Critical Implementation Notes

Always return 200 OK for webhooks - Even if message not found
SendGrid sends arrays - Event webhook payload is always an array
Deduplication required - Use ProcessedEvent model for SendGrid events
Participant ordering - Must be consistent for conversation lookups
Message type inference - MMS determined by attachments presence
Network delay simulation - 100-500ms for mock providers
Status mapping - Provider statuses must map to our enums correctly

Success Criteria

All endpoints match the exact specifications
Rate limiting works with proper headers
Webhook signatures can be verified
Conversations correctly group bidirectional messages
Messages persist with correct status tracking
Force errors work for testing
All bin/test.sh scenarios pass