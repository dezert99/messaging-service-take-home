import {
  testApp,
  createTestSmsWebhook,
  createTestEmailWebhook,
  createTestTwilioStatusWebhook,
  createTestSendGridEvents,
  sendSmsMessage,
  sendEmailMessage,
  getMessageByProviderId,
  expectValidMessage,
  wait
} from '../utils/testHelpers';
import { prisma } from '../setup';

describe('Webhooks API', () => {
  describe('POST /api/webhooks/sms', () => {
    it('should process inbound SMS webhook successfully', async () => {
      const payload = createTestSmsWebhook();

      const response = await testApp
        .post('/api/webhooks/sms')
        .send(payload)
        .expect(200);

      expect(response.text).toBe('OK');

      // Verify message was created in database
      const message = await getMessageByProviderId(payload.messaging_provider_id);
      expect(message).not.toBeNull();
      
      expectValidMessage(message);
      expect(message).toMatchObject({
        from: payload.from,
        to: payload.to,
        type: 'SMS',
        body: payload.body,
        direction: 'INBOUND',
        status: 'RECEIVED',
        providerMessageId: payload.messaging_provider_id,
        provider: 'twilio'
      });

      // Verify conversation was created
      expect(message?.conversation).toMatchObject({
        participant1: '+12345678901', // Lexicographically first
        participant2: '+19876543210',
        channelType: 'SMS'
      });
    });

    it('should process inbound MMS webhook with attachments', async () => {
      const payload = createTestSmsWebhook({
        type: 'mms',
        messaging_provider_id: `MM${Date.now()}`,
        attachments: [
          'https://example.com/image.jpg',
          'https://example.com/video.mp4'
        ]
      });

      await testApp
        .post('/api/webhooks/sms')
        .send(payload)
        .expect(200);

      const message = await getMessageByProviderId(payload.messaging_provider_id);
      expect(message).toMatchObject({
        type: 'MMS',
        attachments: payload.attachments
      });
    });

    it('should link inbound message to existing conversation', async () => {
      // First send an outbound message
      const outboundResponse = await sendSmsMessage({
        from: '+12345678901',
        to: '+19876543210'
      });

      const conversationId = outboundResponse.body.message.conversationId;

      // Then send inbound reply
      const inboundPayload = createTestSmsWebhook({
        from: '+19876543210',
        to: '+12345678901',
        body: 'Reply message'
      });

      await testApp
        .post('/api/webhooks/sms')
        .send(inboundPayload)
        .expect(200);

      const inboundMessage = await getMessageByProviderId(inboundPayload.messaging_provider_id);
      expect(inboundMessage?.conversationId).toBe(conversationId);
    });

    it('should handle webhook validation errors', async () => {
      const response = await testApp
        .post('/api/webhooks/sms')
        .send({
          from: '+12345678901',
          // Missing required fields
        })
        .expect(400);

      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        correlationId: expect.any(String)
      });
    });

    it('should handle duplicate webhook messages', async () => {
      const payload = createTestSmsWebhook();

      // Send the same webhook twice
      await testApp
        .post('/api/webhooks/sms')
        .send(payload)
        .expect(200);

      await testApp
        .post('/api/webhooks/sms')
        .send(payload)
        .expect(200);

      // Should only create one message
      const messages = await prisma.message.findMany({
        where: { providerMessageId: payload.messaging_provider_id }
      });

      expect(messages).toHaveLength(1);
    });
  });

  describe('POST /api/webhooks/email', () => {
    it('should process inbound email webhook successfully', async () => {
      const payload = createTestEmailWebhook();

      const response = await testApp
        .post('/api/webhooks/email')
        .send(payload)
        .expect(200);

      expect(response.text).toBe('OK');

      const message = await getMessageByProviderId(payload.xillio_id);
      expect(message).not.toBeNull();
      
      expectValidMessage(message);
      expect(message).toMatchObject({
        from: payload.from,
        to: payload.to,
        type: 'EMAIL',
        body: payload.body,
        direction: 'INBOUND',
        status: 'RECEIVED',
        providerMessageId: payload.xillio_id,
        provider: 'sendgrid'
      });

      expect(message?.conversation.channelType).toBe('EMAIL');
    });

    it('should handle email attachments', async () => {
      const payload = createTestEmailWebhook({
        attachments: [
          'https://example.com/document.pdf',
          'https://example.com/screenshot.png'
        ]
      });

      await testApp
        .post('/api/webhooks/email')
        .send(payload)
        .expect(200);

      const message = await getMessageByProviderId(payload.xillio_id);
      expect(message?.attachments).toEqual(payload.attachments);
    });

    it('should link to existing email conversation', async () => {
      // Send outbound email first
      const outboundResponse = await sendEmailMessage({
        from: 'support@example.com',
        to: 'customer@example.com'
      });

      const conversationId = outboundResponse.body.message.conversationId;

      // Receive inbound reply
      const inboundPayload = createTestEmailWebhook({
        from: 'customer@example.com',
        to: 'support@example.com',
        body: '<p>Thank you for your help!</p>'
      });

      await testApp
        .post('/api/webhooks/email')
        .send(inboundPayload)
        .expect(200);

      const inboundMessage = await getMessageByProviderId(inboundPayload.xillio_id);
      expect(inboundMessage?.conversationId).toBe(conversationId);
    });
  });

  describe('POST /api/webhooks/sms/status', () => {
    it('should update message status from Twilio webhook', async () => {
      // First send a message
      const messageResponse = await sendSmsMessage();
      const providerMessageId = messageResponse.body.provider.sid;

      // Send status update
      const statusPayload = createTestTwilioStatusWebhook(providerMessageId, 'delivered');

      await testApp
        .post('/api/webhooks/sms/status')
        .send(statusPayload)
        .expect(200);

      // Verify status was updated
      const updatedMessage = await getMessageByProviderId(providerMessageId);
      expect(updatedMessage?.status).toBe('DELIVERED');
    });

    it('should handle failed message status', async () => {
      const messageResponse = await sendSmsMessage();
      const providerMessageId = messageResponse.body.provider.sid;

      const statusPayload = {
        ...createTestTwilioStatusWebhook(providerMessageId, 'failed'),
        ErrorCode: '30008',
        ErrorMessage: 'Unknown error'
      };

      await testApp
        .post('/api/webhooks/sms/status')
        .send(statusPayload)
        .expect(200);

      const updatedMessage = await getMessageByProviderId(providerMessageId);
      expect(updatedMessage?.status).toBe('FAILED');
      expect(updatedMessage?.metadata).toMatchObject({
        statusUpdates: expect.arrayContaining([
          expect.objectContaining({
            status: 'failed',
            errorCode: '30008',
            errorMessage: 'Unknown error'
          })
        ])
      });
    });

    it('should handle status update for non-existent message', async () => {
      const statusPayload = createTestTwilioStatusWebhook('SM_NONEXISTENT', 'delivered');

      // Should return 200 (Twilio expects this)
      await testApp
        .post('/api/webhooks/sms/status')
        .send(statusPayload)
        .expect(200);
    });

    it('should map Twilio statuses correctly', async () => {
      const messageResponse = await sendSmsMessage();
      const providerMessageId = messageResponse.body.provider.sid;

      const statusMappings = [
        { twilioStatus: 'queued', expectedStatus: 'PENDING' },
        { twilioStatus: 'sent', expectedStatus: 'SENT' },
        { twilioStatus: 'delivered', expectedStatus: 'DELIVERED' },
        { twilioStatus: 'failed', expectedStatus: 'FAILED' },
        { twilioStatus: 'undelivered', expectedStatus: 'FAILED' }
      ];

      for (const { twilioStatus, expectedStatus } of statusMappings) {
        // Create a new message for each test
        const newMessageResponse = await sendSmsMessage();
        const newProviderMessageId = newMessageResponse.body.provider.sid;

        await testApp
          .post('/api/webhooks/sms/status')
          .send(createTestTwilioStatusWebhook(newProviderMessageId, twilioStatus))
          .expect(200);

        const updatedMessage = await getMessageByProviderId(newProviderMessageId);
        expect(updatedMessage?.status).toBe(expectedStatus);
      }
    });
  });

  describe('POST /api/webhooks/email/events', () => {
    it('should process SendGrid events successfully', async () => {
      // Send email first
      const messageResponse = await sendEmailMessage();
      const providerMessageId = messageResponse.body.provider.message_id;

      const events = createTestSendGridEvents(providerMessageId, ['processed', 'delivered']);

      await testApp
        .post('/api/webhooks/email/events')
        .send(events)
        .expect(200);

      // Verify status was updated to delivered
      const updatedMessage = await getMessageByProviderId(providerMessageId);
      expect(updatedMessage?.status).toBe('DELIVERED');

      // Verify events were marked as processed
      for (const event of events) {
        const processedEvent = await prisma.processedEvent.findUnique({
          where: { id: event.sg_event_id }
        });
        expect(processedEvent).not.toBeNull();
      }
    });

    it('should handle bounce events', async () => {
      const messageResponse = await sendEmailMessage();
      const providerMessageId = messageResponse.body.provider.message_id;

      const bounceEvents = [{
        email: 'invalid@example.com',
        timestamp: Date.now(),
        'smtp-id': '<test@example.com>',
        event: 'bounce',
        sg_event_id: `bounce_${Date.now()}`,
        sg_message_id: providerMessageId,
        reason: '550 5.1.1 User unknown',
        type: 'bounce'
      }];

      await testApp
        .post('/api/webhooks/email/events')
        .send(bounceEvents)
        .expect(200);

      const updatedMessage = await getMessageByProviderId(providerMessageId);
      expect(updatedMessage?.status).toBe('FAILED');
      expect(updatedMessage?.metadata).toMatchObject({
        sendGridEvents: expect.arrayContaining([
          expect.objectContaining({
            event: 'bounce',
            reason: '550 5.1.1 User unknown'
          })
        ])
      });
    });

    it('should prevent duplicate event processing', async () => {
      const messageResponse = await sendEmailMessage();
      const providerMessageId = messageResponse.body.provider.message_id;

      const events = createTestSendGridEvents(providerMessageId, ['delivered']);

      // Send the same events twice
      await testApp
        .post('/api/webhooks/email/events')
        .send(events)
        .expect(200);

      await testApp
        .post('/api/webhooks/email/events')
        .send(events)
        .expect(200);

      // Should only process once
      const processedEvents = await prisma.processedEvent.findMany({
        where: { id: events[0]?.sg_event_id }
      });

      expect(processedEvents).toHaveLength(1);
    });

    it('should handle events for non-existent messages', async () => {
      const events = createTestSendGridEvents('nonexistent_message_id', ['delivered']);

      // Should return 200 (SendGrid expects this)
      await testApp
        .post('/api/webhooks/email/events')
        .send(events)
        .expect(200);
    });

    it('should process multiple event types correctly', async () => {
      const messageResponse = await sendEmailMessage();
      const providerMessageId = messageResponse.body.provider.message_id;

      const events = [
        {
          email: 'recipient@example.com',
          timestamp: Date.now(),
          'smtp-id': '<test@example.com>',
          event: 'processed',
          sg_event_id: `processed_${Date.now()}`,
          sg_message_id: providerMessageId
        },
        {
          email: 'recipient@example.com',
          timestamp: Date.now() + 1000,
          'smtp-id': '<test@example.com>',
          event: 'open',
          sg_event_id: `open_${Date.now()}`,
          sg_message_id: providerMessageId
        },
        {
          email: 'recipient@example.com',
          timestamp: Date.now() + 2000,
          'smtp-id': '<test@example.com>',
          event: 'click',
          sg_event_id: `click_${Date.now()}`,
          sg_message_id: providerMessageId,
          url: 'https://example.com/link'
        }
      ];

      await testApp
        .post('/api/webhooks/email/events')
        .send(events)
        .expect(200);

      // Message should be marked as SENT after processing event
      const updatedMessage = await getMessageByProviderId(providerMessageId);
      expect(updatedMessage?.status).toBe('SENT');

      // All events should be marked as processed
      for (const event of events) {
        const processedEvent = await prisma.processedEvent.findUnique({
          where: { id: event.sg_event_id }
        });
        expect(processedEvent).not.toBeNull();
      }
    });
  });

  describe('Webhook Authentication', () => {
    it('should work with authentication disabled', async () => {
      // Our test setup disables auth with SKIP_WEBHOOK_AUTH=true
      const payload = createTestSmsWebhook();

      await testApp
        .post('/api/webhooks/sms')
        .send(payload)
        .expect(200);
    });

    // Note: Testing actual signature verification would require
    // complex setup with real signatures. For production, ensure
    // SKIP_WEBHOOK_AUTH is not set to true.
  });

  describe('Error Handling', () => {
    it('should return proper error format', async () => {
      const response = await testApp
        .post('/api/webhooks/sms')
        .send({}) // Invalid payload
        .expect(400);

      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        correlationId: expect.any(String)
      });
    });

    it('should handle malformed JSON gracefully', async () => {
      await testApp
        .post('/api/webhooks/sms')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });
  });
});