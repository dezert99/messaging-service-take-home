Complete Task List with Code
Task 1: Project Setup and Configuration
Status: ✅ COMPLETED
Priority: HIGH
Complexity: SIMPLE
Dependencies: None
AI-Suitable: Yes
Description
Initialize the Express TypeScript project with all necessary dependencies and configuration files.
Acceptance Criteria

 TypeScript configured with strict mode
 Express server runs on port 8080
 Environment variables loaded from .env
 Basic health check endpoint works
 bin/start.sh script starts the server

Implementation Plan

 Initialize npm project and install dependencies
 Configure TypeScript (tsconfig.json)
 Set up Express server with middleware
 Create environment configuration
 Update bin/start.sh to run the TypeScript app
 Add health check endpoint

Files to Modify

package.json (NEW)
tsconfig.json (NEW)
src/app.ts (NEW)
src/server.ts (NEW)
.env (NEW)
bin/start.sh (MODIFY)
.gitignore (NEW)


Task 2: Database Setup with Prisma
Status: ✅ COMPLETED
Priority: HIGH
Complexity: MODERATE
Dependencies: Task 1
AI-Suitable: Yes
Description
Set up Prisma ORM with PostgreSQL, create the database schema with all models.
Acceptance Criteria

 Prisma schema defined with all models and enums
 Participant columns for efficient querying
 ProcessedEvent model for deduplication
 Migrations created and applied
 Prisma client generates properly

Implementation Plan

 Initialize Prisma with PostgreSQL
 Define complete schema (Conversation, Message, ProcessedEvent, enums)
 Create participant normalization utility
 Create initial migration
 Set up Prisma client singleton

Files to Modify

prisma/schema.prisma (NEW)
src/lib/prisma.ts (NEW)
src/utils/participants.ts (NEW)
.env (MODIFY - add DATABASE_URL)

Implementation Code:
// prisma/schema.prisma

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
  
  // Provider tracking
  providerMessageId String?          // messaging_provider_id for SMS/MMS, xillio_id for email
  provider          String?          // "twilio" or "sendgrid"
  
  // Optional metadata for errors or additional data
  metadata          Json?            // For error codes, retry counts, etc.
  
  timestamp         DateTime         // From the payload
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
  
  @@index([conversationId])
  @@index([from, to])
  @@index([providerMessageId])
  @@index([timestamp])
}

// For SendGrid event deduplication
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

typescript// src/utils/participants.ts
/**
 * Normalize participants to ensure consistent ordering for database lookups
 * Always returns [smaller, larger] when sorted lexicographically
 */
export function normalizeParticipants(from: string, to: string): [string, string] {
  return from < to ? [from, to] : [to, from];
}

// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma client
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

Task 3: Mock Provider Services
Status: ✅ COMPLETED
Priority: HIGH
Complexity: MODERATE
Dependencies: Task 1
AI-Suitable: Yes
Description
Create mock SMS/MMS and Email provider services that simulate Twilio and SendGrid behavior.
Acceptance Criteria

 MockSmsProvider returns Twilio-like responses
 MockEmailProvider returns SendGrid-like responses
 Support for _forceError field to trigger errors
 Realistic message IDs generated
 Network delay simulation

Implementation Plan

 Create provider interfaces with force error support
 Implement MockSmsProvider with Twilio response format
 Implement MockEmailProvider with SendGrid response format
 Add message ID generation logic
 Add configurable delay simulation

Files to Modify

src/providers/interfaces.ts (NEW)
src/providers/MockSmsProvider.ts (NEW)
src/providers/MockEmailProvider.ts (NEW)
src/providers/index.ts (NEW)

Implementation Code:
typescript// src/providers/interfaces.ts
export interface SmsMmsPayload {
  from: string;
  to: string;
  type: 'sms' | 'mms';
  body: string;
  attachments?: string[] | null;
  timestamp: string;
  _forceError?: {
    code: 429 | 500 | 400 | 503;
    message?: string;
  };
}

export interface EmailPayload {
  from: string;
  to: string;
  body: string;
  attachments?: string[];
  timestamp: string;
  _forceError?: {
    code: 429 | 500 | 400 | 503;
    message?: string;
  };
}

export interface ProviderError extends Error {
  statusCode: number;
}

export interface MockTwilioResponse {
  sid: string;
  account_sid: string;
  from: string;
  to: string;
  body: string;
  status: 'queued' | 'sent' | 'failed';
  num_segments: string;
  direction: 'outbound-api';
  price: string;
  price_unit: 'USD';
  date_created: string;
  date_updated: string;
  uri: string;
}

export interface MockSendGridResponse {
  statusCode: 202;
  message_id: string;
  body: null;
}

// src/providers/MockSmsProvider.ts
import crypto from 'crypto';
import { SmsMmsPayload, MockTwilioResponse, ProviderError } from './interfaces';

export class MockSmsProvider {
  private generateMessageSid(type: 'sms' | 'mms'): string {
    const prefix = type === 'mms' ? 'MM' : 'SM';
    const random = crypto.randomBytes(16).toString('hex');
    return `${prefix}${random}`;
  }

  async sendMessage(payload: SmsMmsPayload): Promise<MockTwilioResponse> {
    // Check for forced errors
    if (payload._forceError) {
      const error = new Error(
        payload._forceError.message || `Provider error: ${payload._forceError.code}`
      ) as ProviderError;
      error.statusCode = payload._forceError.code;
      throw error;
    }

    // Simulate network delay (100-500ms)
    await this.simulateDelay();

    const sid = this.generateMessageSid(payload.type);

    // Return Twilio-like response
    return {
      sid,
      account_sid: 'ACmock1234567890abcdef1234567890',
      from: payload.from,
      to: payload.to,
      body: payload.body,
      status: 'queued',
      num_segments: Math.ceil(payload.body.length / 160).toString(),
      direction: 'outbound-api',
      price: '-0.00750',
      price_unit: 'USD',
      date_created: new Date().toISOString(),
      date_updated: new Date().toISOString(),
      uri: `/2010-04-01/Accounts/ACmock/Messages/${sid}.json`
    };
  }

  private async simulateDelay(): Promise<void> {
    const delay = Math.random() * 400 + 100; // 100-500ms
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

// src/providers/MockEmailProvider.ts
import crypto from 'crypto';
import { EmailPayload, MockSendGridResponse, ProviderError } from './interfaces';

export class MockEmailProvider {
  private generateMessageId(): string {
    const random = crypto.randomBytes(8).toString('hex');
    return `${random}.filter001.${Date.now()}.0`;
  }

  async sendEmail(payload: EmailPayload): Promise<MockSendGridResponse> {
    // Check for forced errors
    if (payload._forceError) {
      const error = new Error(
        payload._forceError.message || `Provider error: ${payload._forceError.code}`
      ) as ProviderError;
      error.statusCode = payload._forceError.code;
      throw error;
    }

    // Simulate network delay
    await this.simulateDelay();

    // Return SendGrid-like response
    return {
      statusCode: 202,
      message_id: this.generateMessageId(),
      body: null
    };
  }

  private async simulateDelay(): Promise<void> {
    const delay = Math.random() * 400 + 100;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

Task 4: Rate Limiting Middleware
Status: ✅ COMPLETED
Priority: HIGH
Complexity: MODERATE
Dependencies: Task 1
AI-Suitable: Yes
Description
Implement real rate limiting for SMS and Email endpoints with configurable limits.
Acceptance Criteria

 Separate limits for SMS and Email endpoints
 Returns 429 with Retry-After header
 X-RateLimit headers included
 Configurable via environment variables
 In-memory token bucket implementation

Implementation Plan

 Create rate limiter class with token bucket algorithm
 Implement middleware factory for different limits
 Add rate limit headers to responses
 Configure limits from environment
 Add rate limit reset logic

Files to Modify

src/middleware/rateLimiter.ts (NEW)
src/config/rateLimits.ts (NEW)
.env (MODIFY - add rate limit configs)

Implementation Code:
typescript// src/config/rateLimits.ts
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
}

export const rateLimits = {
  sms: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: parseInt(process.env.SMS_RATE_LIMIT || '100'),
    message: 'SMS rate limit exceeded. Please retry after some time.'
  },
  email: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: parseInt(process.env.EMAIL_RATE_LIMIT || '500'),
    message: 'Email rate limit exceeded. Please retry after some time.'
  }
};

// src/middleware/rateLimiter.ts
import { Request, Response, NextFunction } from 'express';
import { RateLimitConfig } from '../config/rateLimits';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  windowStart: number;
}

export class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  
  constructor(private config: RateLimitConfig) {}

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.getKey(req);
      const now = Date.now();
      
      let bucket = this.buckets.get(key);
      
      if (!bucket || now - bucket.windowStart >= this.config.windowMs) {
        // New window or window expired
        bucket = {
          tokens: this.config.maxRequests - 1,
          lastRefill: now,
          windowStart: now
        };
        this.buckets.set(key, bucket);
        
        // Set headers
        res.setHeader('X-RateLimit-Limit', this.config.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', bucket.tokens.toString());
        res.setHeader('X-RateLimit-Reset', new Date(bucket.windowStart + this.config.windowMs).toISOString());
        
        return next();
      }
      
      if (bucket.tokens > 0) {
        bucket.tokens--;
        
        // Set headers
        res.setHeader('X-RateLimit-Limit', this.config.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', bucket.tokens.toString());
        res.setHeader('X-RateLimit-Reset', new Date(bucket.windowStart + this.config.windowMs).toISOString());
        
        return next();
      }
      
      // Rate limit exceeded
      const retryAfter = Math.ceil((bucket.windowStart + this.config.windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      res.setHeader('X-RateLimit-Limit', this.config.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', new Date(bucket.windowStart + this.config.windowMs).toISOString());
      
      res.status(429).json({
        error: this.config.message,
        retryAfter
      });
    };
  }
  
  private getKey(req: Request): string {
    // In production, you might want to use IP address or user ID
    return req.ip || 'global';
  }
}

Task 5: Outbound Message API Endpoints
Status: ✅ COMPLETED
Priority: HIGH
Complexity: MODERATE
Dependencies: Tasks 2, 3
AI-Suitable: Yes
Description
Implement API endpoints for sending SMS/MMS and Email messages.
Acceptance Criteria

 POST /api/messages/sms handles both SMS and MMS
 POST /api/messages/email handles email
 Request validation with Joi/Zod
 Messages saved with correct type (SMS vs MMS)
 Conversations created/updated automatically
 Rate limiting applied

Implementation Plan

 Create message controller with send methods
 Add request validation schemas
 Implement conversation finding/creation
 Integrate with mock providers
 Handle force error scenarios
 Apply rate limiting middleware

Files to Modify

src/routes/messages.ts (NEW)
src/controllers/messageController.ts (NEW)
src/services/messageService.ts (NEW)
src/services/conversationService.ts (NEW)
src/middleware/validation.ts (NEW)
src/types/requests.ts (NEW)

Implementation Code:
typescript// src/services/conversationService.ts
import { prisma } from '../lib/prisma';
import { ChannelType } from '@prisma/client';
import { normalizeParticipants } from '../utils/participants';

export async function findOrCreateConversation(
  from: string, 
  to: string, 
  channelType: ChannelType
) {
  const [participant1, participant2] = normalizeParticipants(from, to);
  
  return await prisma.conversation.upsert({
    where: {
      participant1_participant2_channelType: {
        participant1,
        participant2,
        channelType
      }
    },
    create: {
      participant1,
      participant2,
      channelType,
      lastMessageAt: new Date()
    },
    update: {
      lastMessageAt: new Date()
    }
  });
}

export async function getUserConversations(userIdentifier: string, channelType?: ChannelType) {
  return await prisma.conversation.findMany({
    where: {
      AND: [
        {
          OR: [
            { participant1: userIdentifier },
            { participant2: userIdentifier }
          ]
        },
        channelType ? { channelType } : {}
      ]
    },
    orderBy: {
      lastMessageAt: 'desc'
    },
    include: {
      messages: {
        take: 1,
        orderBy: {
          timestamp: 'desc'
        }
      }
    }
  });
}

// src/utils/messageType.ts
import { MessageType } from '@prisma/client';

export function determineMessageType(payload: any): MessageType {
  if (payload.type === 'email' || payload.from.includes('@')) {
    return MessageType.EMAIL;
  } else if (payload.type === 'mms' || (payload.attachments && payload.attachments.length > 0)) {
    return MessageType.MMS;
  } else {
    return MessageType.SMS;
  }
}

export function getChannelType(messageType: MessageType): ChannelType {
  return messageType === MessageType.EMAIL ? ChannelType.EMAIL : ChannelType.SMS;
}

Task 6: Webhook Endpoints
Status: ✅ COMPLETED
Priority: HIGH
Complexity: MODERATE
Dependencies: Tasks 2, 5
AI-Suitable: Yes
Description
Implement webhook endpoints for inbound messages and status updates, matching Twilio and SendGrid APIs exactly.
Acceptance Criteria

 POST /api/webhooks/sms for inbound SMS/MMS
 POST /api/webhooks/email for inbound emails
 POST /api/webhooks/sms/status for Twilio status
 POST /api/webhooks/email/events for SendGrid events
 Exact field names match provider APIs
 Event deduplication for SendGrid
 Returns proper status codes

Implementation Plan

 Create webhook controller with four endpoints
 Implement inbound message handlers
 Implement Twilio status webhook handler
 Implement SendGrid events webhook handler
 Add event deduplication logic
 Map provider statuses to our enums

Files to Modify

src/routes/webhooks.ts (NEW)
src/controllers/webhookController.ts (NEW)
src/types/webhooks.ts (NEW)
src/utils/statusMapping.ts (NEW)

Implementation Code:
typescript// src/types/webhooks.ts

// Inbound message webhooks (from README)
export interface InboundSmsWebhook {
  from: string;
  to: string;
  type: 'sms' | 'mms';
  messaging_provider_id: string;
  body: string;
  attachments?: string[] | null;
  timestamp: string;
}

export interface InboundEmailWebhook {
  from: string;
  to: string;
  xillio_id: string;
  body: string;
  attachments?: string[];
  timestamp: string;
}

// Status update webhooks (matching real providers)
export interface TwilioStatusWebhook {
  MessageSid: string;
  MessageStatus: 'queued' | 'failed' | 'sent' | 'delivered' | 'undelivered';
  AccountSid: string;
  From: string;
  To: string;
  ApiVersion: string;
  ErrorCode?: string;
  ErrorMessage?: string;
  SmsSid?: string;      // Legacy, same as MessageSid
  SmsStatus?: string;    // Legacy, same as MessageStatus
  Body?: string;
  NumSegments?: string;
  NumMedia?: string;
}

export interface SendGridEventWebhook {
  email: string;
  timestamp: number;
  'smtp-id': string;
  event: 'processed' | 'dropped' | 'delivered' | 'deferred' | 
         'bounce' | 'open' | 'click' | 'spam_report' | 'unsubscribe';
  sg_event_id: string;
  sg_message_id: string;
  category?: string[];
  reason?: string;
  status?: string;
  response?: string;
  attempt?: string;
  ip?: string;
  url?: string;
  useragent?: string;
  type?: string;
  sg_machine_open?: boolean;
}

// src/controllers/webhookController.ts (partial)
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { MessageStatus, MessageDirection, MessageType } from '@prisma/client';
import { TwilioStatusWebhook, SendGridEventWebhook } from '../types/webhooks';

export async function handleTwilioStatusWebhook(req: Request, res: Response) {
  const webhook: TwilioStatusWebhook = req.body;
  
  try {
    // Find message by Twilio's MessageSid
    const message = await prisma.message.findFirst({
      where: { providerMessageId: webhook.MessageSid }
    });
    
    if (!message) {
      // Twilio expects 200 even if we don't have the message
      console.warn(`Message not found for SID: ${webhook.MessageSid}`);
      return res.status(200).send('OK');
    }
    
    // Map Twilio status to our status
    const newStatus = mapTwilioStatus(webhook.MessageStatus);
    
    // Update message status
    await prisma.message.update({
      where: { id: message.id },
      data: { 
        status: newStatus,
        // Store error info if failed
        ...(webhook.ErrorCode && {
          metadata: {
            errorCode: webhook.ErrorCode,
            errorMessage: webhook.ErrorMessage
          }
        })
      }
    });
    
    // Twilio expects 200 OK or 204 No Content
    res.status(200).send('OK');
  } catch (error) {
    console.error('Twilio webhook error:', error);
    // Twilio will retry on 5xx errors
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function handleSendGridEventWebhook(req: Request, res: Response) {
  // SendGrid sends an array of events
  const events: SendGridEventWebhook[] = req.body;
  
  try {
    // Process each event
    for (const event of events) {
      // Skip if we've already processed this event (deduplication)
      const existing = await prisma.processedEvent.findUnique({
        where: { id: event.sg_event_id }
      });
      
      if (existing) continue;
      
      // Find message by SendGrid's message ID
      const message = await prisma.message.findFirst({
        where: { providerMessageId: event.sg_message_id }
      });
      
      if (!message) {
        console.warn(`Message not found for ID: ${event.sg_message_id}`);
        continue;
      }
      
      // Update based on event type
      switch (event.event) {
        case 'processed':
          await prisma.message.update({
            where: { id: message.id },
            data: { status: MessageStatus.SENT }
          });
          break;
        case 'delivered':
          await prisma.message.update({
            where: { id: message.id },
            data: { status: MessageStatus.DELIVERED }
          });
          break;
        case 'bounce':
        case 'dropped':
          await prisma.message.update({
            where: { id: message.id },
            data: { 
              status: MessageStatus.FAILED,
              metadata: {
                reason: event.reason,
                response: event.response
              }
            }
          });
          break;
        // Other events like 'open', 'click' can be tracked separately
      }
      
      // Mark event as processed
      await prisma.processedEvent.create({
        data: { id: event.sg_event_id }
      });
    }
    
    // SendGrid expects 200 OK
    res.status(200).send('OK');
  } catch (error) {
    console.error('SendGrid webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// src/utils/statusMapping.ts
import { MessageStatus } from '@prisma/client';

export function mapTwilioStatus(twilioStatus: string): MessageStatus {
  const statusMap: Record<string, MessageStatus> = {
    'queued': MessageStatus.PENDING,
    'sent': MessageStatus.SENT,
    'delivered': MessageStatus.DELIVERED,
    'failed': MessageStatus.FAILED,
    'undelivered': MessageStatus.FAILED
  };
  return statusMap[twilioStatus] || MessageStatus.SENT;
}

Task 7: Webhook Authentication
Status: ✅ COMPLETED
Priority: MEDIUM
Complexity: MODERATE
Dependencies: Task 6
AI-Suitable: Yes
Description
Implement webhook signature verification for both Twilio and SendGrid webhooks.
Acceptance Criteria

 Twilio signature verification (HMAC-SHA1)
 SendGrid signature verification (HMAC-SHA256)
 Configurable webhook secrets
 Can be disabled for testing
 Returns 401 for invalid signatures

Implementation Plan

 Create webhook auth middleware
 Implement Twilio signature algorithm
 Implement SendGrid signature algorithm
 Add bypass option for development
 Document signature generation

Files to Modify

src/middleware/webhookAuth.ts (NEW)
src/utils/crypto.ts (NEW)
.env (MODIFY - add webhook secrets)

Implementation Code:
typescript// src/middleware/webhookAuth.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function verifyTwilioWebhook(req: Request, res: Response, next: NextFunction) {
  // Skip verification if not configured or in test mode
  if (!process.env.TWILIO_AUTH_TOKEN || process.env.SKIP_WEBHOOK_AUTH === 'true') {
    return next();
  }
  
  const signature = req.headers['x-twilio-signature'] as string;
  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }
  
  // Construct the full URL
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  
  // Sort POST parameters alphabetically and concatenate
  const params = Object.keys(req.body)
    .sort()
    .reduce((acc, key) => acc + key + req.body[key], url);
  
  // Generate expected signature
  const expectedSignature = crypto
    .createHmac('sha1', process.env.TWILIO_AUTH_TOKEN)
    .update(params)
    .digest('base64');
  
  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  next();
}

export function verifySendGridWebhook(req: Request, res: Response, next: NextFunction) {
  // Skip verification if not configured or in test mode
  if (!process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY || process.env.SKIP_WEBHOOK_AUTH === 'true') {
    return next();
  }
  
  const signature = req.headers['x-twilio-email-event-webhook-signature'] as string;
  const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string;
  
  if (!signature || !timestamp) {
    return res.status(401).json({ error: 'Missing signature or timestamp' });
  }
  
  // Verify timestamp is recent (within 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
    return res.status(401).json({ error: 'Timestamp too old' });
  }
  
  // Generate expected signature
  const payload = timestamp + JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY)
    .update(payload)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  next();
}

Task 8: Conversation Management API
Status: ✅ COMPLETED
Priority: MEDIUM
Complexity: MODERATE
Dependencies: Tasks 2, 5, 6
AI-Suitable: Yes
Description
Implement conversation listing and message retrieval endpoints with channel separation.
Acceptance Criteria

 GET /api/conversations returns paginated list
 GET /api/conversations/:id/messages returns messages
 Can filter by channelType
 Messages sorted chronologically
 Participant normalization works correctly

Implementation Plan

 Create conversation controller
 Implement conversation listing with pagination
 Implement message retrieval for conversation
 Add channel filtering options
 Ensure bidirectional message grouping

Files to Modify

src/routes/conversations.ts (NEW)
src/controllers/conversationController.ts (NEW)
src/services/conversationService.ts (MODIFY)


Task 9: Rate Limit Testing Script
Status: ✅ Skipped not needed
Priority: MEDIUM
Complexity: SIMPLE
Dependencies: Task 4
AI-Suitable: Yes
Description
Create a demonstration script that tests and validates rate limiting functionality.
Acceptance Criteria

 Tests both SMS and Email rate limits
 Shows when limits are hit
 Displays rate limit headers
 Demonstrates window reset
 Clear visual output

Implementation Plan

 Create Node.js test script
 Implement parallel request sending
 Parse and display headers
 Add timing for window resets
 Format output clearly

Files to Modify

scripts/test-rate-limit.js (NEW)
package.json (MODIFY - add script command)

Implementation Code:
javascript// scripts/test-rate-limit.js
#!/usr/bin/env node

const http = require('http');

const BASE_URL = 'http://localhost:8080';
const SMS_LIMIT = 100;  // Should match your config
const EMAIL_LIMIT = 500; // Should match your config

async function makeRequest(endpoint, data) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body ? JSON.parse(body) : null
        });
      });
    });

    req.write(postData);
    req.end();
  });
}

async function testRateLimit(endpoint, limit, type) {
  console.log(`\nTesting ${type} Rate Limiting (${limit} req/min)`);
  console.log('='.repeat(50));
  
  const testData = type === 'SMS' ? {
    from: '+12016661234',
    to: '+18045551234',
    type: 'sms',
    body: 'Rate limit test',
    timestamp: new Date().toISOString()
  } : {
    from: 'test@example.com',
    to: 'user@example.com',
    body: 'Rate limit test',
    timestamp: new Date().toISOString()
  };

  // Send requests up to and beyond the limit
  const totalRequests = limit + 20;
  let successCount = 0;
  let rateLimitedCount = 0;
  let lastHeaders = {};

  console.log(`Sending ${totalRequests} requests...`);
  
  for (let i = 1; i <= totalRequests; i++) {
    const response = await makeRequest(endpoint, testData);
    
    if (response.status === 200 || response.status === 201) {
      successCount++;
      lastHeaders = response.headers;
      
      if (i === limit) {
        console.log(`[✓] Request ${i}: Success (${response.status})`);
        console.log(`    X-RateLimit-Remaining: ${response.headers['x-ratelimit-remaining']}`);
      }
    } else if (response.status === 429) {
      rateLimitedCount++;
      
      if (rateLimitedCount === 1) {
        console.log(`[✗] Request ${i}: Rate limited (429)`);
        console.log(`    Retry-After: ${response.headers['retry-after']}s`);
      }
    }
  }
  
  console.log(`\nResults:`);
  console.log(`  Successful: ${successCount}/${totalRequests}`);
  console.log(`  Rate Limited: ${rateLimitedCount}/${totalRequests}`);
  
  if (lastHeaders['x-ratelimit-limit']) {
    console.log(`\nRate Limit Headers:`);
    console.log(`  X-RateLimit-Limit: ${lastHeaders['x-ratelimit-limit']}`);
    console.log(`  X-RateLimit-Reset: ${lastHeaders['x-ratelimit-reset']}`);
  }
  
  // Test window reset
  if (rateLimitedCount > 0) {
    console.log(`\nWaiting 60 seconds for window reset...`);
    await new Promise(resolve => setTimeout(resolve, 61000));
    
    const resetResponse = await makeRequest(endpoint, testData);
    console.log(`[✓] Request after reset: ${resetResponse.status === 200 ? 'Success' : 'Failed'}`);
  }
}

async function main() {
  console.log('Rate Limiting Test Script');
  console.log('========================');
  
  // Test SMS rate limiting
  await testRateLimit('/api/messages/sms', SMS_LIMIT, 'SMS');
  
  // Test Email rate limiting
  await testRateLimit('/api/messages/email', EMAIL_LIMIT, 'Email');
  
  console.log('\n✅ Rate limiting tests complete!');
}

main().catch(console.error);

Task 10: Error Handling and Logging
Status: 🔴 Not Started
Priority: MEDIUM
Complexity: SIMPLE
Dependencies: Tasks 1-8
AI-Suitable: Yes
Description
Implement comprehensive error handling and structured logging.
Acceptance Criteria

 Global error handler middleware
 Structured logging with Winston/Pino
 Request/response logging
 Async error handling
 Custom error classes

Implementation Plan

 Set up Winston or Pino logger
 Create error handling middleware
 Add request logging middleware
 Implement custom error classes
 Add logging throughout services

Files to Modify

src/middleware/errorHandler.ts (NEW)
src/middleware/requestLogger.ts (NEW)
src/utils/logger.ts (NEW)
src/utils/errors.ts (NEW)


Task 11: Testing Setup and Implementation
Status: 🔴 Not Started
Priority: HIGH
Complexity: MODERATE
Dependencies: Tasks 1-10
AI-Suitable: Partial
Description
Set up testing framework and write comprehensive tests matching bin/test.sh scenarios.
Acceptance Criteria

 Jest configured for TypeScript
 All bin/test.sh scenarios pass
 Rate limiting tests included
 Force error tests included
 Webhook tests with signature verification
 Database properly handled in tests

Implementation Plan

 Configure Jest for TypeScript
 Set up test database strategy
 Write API integration tests
 Test rate limiting scenarios
 Test webhook signatures
 Update bin/test.sh to include new tests

Files to Modify

jest.config.js (NEW)
tests/api/messages.test.ts (NEW)
tests/api/webhooks.test.ts (NEW)
tests/api/conversations.test.ts (NEW)
tests/api/rateLimiting.test.ts (NEW)
bin/test.sh (MODIFY)


Task 12: Documentation and Final Polish
Status: 🔴 Not Started
Priority: LOW
Complexity: SIMPLE
Dependencies: All tasks
AI-Suitable: Yes
Description
Complete documentation, update README, and ensure all scripts work correctly.
Acceptance Criteria

 README with complete setup instructions
 API documentation with examples
 Environment variables documented
 All make commands working
 Rate limiting documentation
 Webhook signature setup guide

Implementation Plan

 Update README with setup instructions
 Document all environment variables
 Create API documentation with examples
 Document rate limiting configuration
 Add webhook testing instructions
 Verify all make commands

Files to Modify

README.md (MODIFY)
.env.example (NEW)
docs/API.md (NEW)
docs/WEBHOOKS.md (NEW)
docs/RATE_LIMITING.md (NEW)