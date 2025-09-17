import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../setup';

export const testApp = request(app);

// Test data factories
export const createTestSmsPayload = (overrides: any = {}) => ({
  from: '+12345678901',
  to: '+19876543210', 
  type: 'sms',
  body: 'Test SMS message',
  timestamp: new Date().toISOString(),
  ...overrides
});

export const createTestMmsPayload = (overrides: any = {}) => ({
  from: '+12345678901',
  to: '+19876543210',
  type: 'mms', 
  body: 'Test MMS message',
  attachments: ['https://example.com/image.jpg'],
  timestamp: new Date().toISOString(),
  ...overrides
});

export const createTestEmailPayload = (overrides: any = {}) => ({
  from: 'sender@example.com',
  to: 'recipient@example.com',
  body: '<p>Test email message</p>',
  attachments: ['https://example.com/document.pdf'],
  timestamp: new Date().toISOString(),
  ...overrides
});

export const createTestSmsWebhook = (overrides: any = {}) => ({
  from: '+19876543210',
  to: '+12345678901',
  type: 'sms',
  messaging_provider_id: `SM${Date.now()}`,
  body: 'Inbound test message',
  timestamp: new Date().toISOString(),
  ...overrides
});

export const createTestEmailWebhook = (overrides: any = {}) => ({
  from: 'customer@example.com',
  to: 'support@example.com',
  xillio_id: `${Date.now()}.filter001.${Date.now()}.0`,
  body: '<p>Inbound email message</p>',
  timestamp: new Date().toISOString(),
  ...overrides
});

export const createTestTwilioStatusWebhook = (messageSid: string, status = 'delivered') => ({
  MessageSid: messageSid,
  MessageStatus: status,
  AccountSid: 'ACmock1234567890abcdef1234567890',
  From: '+12345678901',
  To: '+19876543210',
  ApiVersion: '2010-04-01'
});

export const createTestSendGridEvents = (messageId: string, events = ['processed', 'delivered']) => 
  events.map((event, index) => ({
    email: 'recipient@example.com',
    timestamp: Date.now() + index,
    'smtp-id': `<test.${Date.now()}@example.com>`,
    event,
    sg_event_id: `sg_event_${Date.now()}_${index}`,
    sg_message_id: messageId
  }));

// Database helpers
export const getMessageByProviderId = async (providerId: string) => {
  return await prisma.message.findFirst({
    where: { providerMessageId: providerId },
    include: { conversation: true }
  });
};

export const getConversationWithMessages = async (conversationId: string) => {
  return await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { 
      messages: {
        orderBy: { timestamp: 'asc' }
      }
    }
  });
};

export const createTestConversation = async (participant1: string, participant2: string, channelType = 'SMS') => {
  return await prisma.conversation.create({
    data: {
      participant1: participant1 < participant2 ? participant1 : participant2,
      participant2: participant1 < participant2 ? participant2 : participant1,
      channelType: channelType as any,
      lastMessageAt: new Date()
    }
  });
};

// Wait utilities
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// API helpers
export const sendSmsMessage = async (payload: any = {}) => {
  const data = createTestSmsPayload(payload);
  return await testApp
    .post('/api/messages/sms')
    .send(data)
    .expect(201);
};

export const sendEmailMessage = async (payload: any = {}) => {
  const data = createTestEmailPayload(payload);
  return await testApp
    .post('/api/messages/email')
    .send(data)
    .expect(201);
};

export const sendSmsWebhook = async (payload: any = {}) => {
  const data = createTestSmsWebhook(payload);
  return await testApp
    .post('/api/webhooks/sms')
    .send(data)
    .expect(200);
};

export const sendEmailWebhook = async (payload: any = {}) => {
  const data = createTestEmailWebhook(payload);
  return await testApp
    .post('/api/webhooks/email')
    .send(data)
    .expect(200);
};

export const sendTwilioStatusWebhook = async (messageSid: string, status = 'delivered') => {
  const data = createTestTwilioStatusWebhook(messageSid, status);
  return await testApp
    .post('/api/webhooks/sms/status')
    .send(data)
    .expect(200);
};

export const sendSendGridEventsWebhook = async (messageId: string, events = ['processed', 'delivered']) => {
  const data = createTestSendGridEvents(messageId, events);
  return await testApp
    .post('/api/webhooks/email/events')
    .send(data)
    .expect(200);
};

// Rate limiting helpers
export const sendMultipleRequests = async (endpoint: string, payload: any, count: number) => {
  const promises = [];
  for (let i = 0; i < count; i++) {
    promises.push(
      testApp
        .post(endpoint)
        .send(payload)
    );
  }
  return await Promise.all(promises);
};

// Validation helpers
export const expectValidMessage = (message: any) => {
  expect(message).toMatchObject({
    id: expect.any(String),
    from: expect.any(String),
    to: expect.any(String),
    type: expect.stringMatching(/^(SMS|MMS|EMAIL)$/),
    body: expect.any(String),
    direction: expect.stringMatching(/^(INBOUND|OUTBOUND)$/),
    status: expect.stringMatching(/^(PENDING|SENT|DELIVERED|FAILED|RECEIVED)$/),
    timestamp: expect.anything(), // Can be Date or string
    createdAt: expect.anything()  // Can be Date or string
  });
  
  expect(message.id).toBeValidUUID();
};

export const expectValidConversation = (conversation: any) => {
  expect(conversation).toMatchObject({
    id: expect.any(String),
    participant1: expect.any(String),
    participant2: expect.any(String),
    channelType: expect.stringMatching(/^(SMS|EMAIL)$/),
    lastMessageAt: expect.any(String),
    createdAt: expect.any(String),
    updatedAt: expect.any(String)
  });
  
  expect(conversation.id).toBeValidUUID();
};

export const expectRateLimitHeaders = (response: any) => {
  expect(response.headers).toHaveProperty('x-ratelimit-limit');
  expect(response.headers).toHaveProperty('x-ratelimit-remaining');
  expect(response.headers).toHaveProperty('x-ratelimit-reset');
  
  expect(response.headers['x-ratelimit-limit']).toMatch(/^\d+$/);
  expect(response.headers['x-ratelimit-remaining']).toMatch(/^\d+$/);
  expect(response.headers['x-ratelimit-reset']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
};