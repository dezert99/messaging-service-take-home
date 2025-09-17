import {
  testApp,
  sendSmsMessage,
  sendEmailMessage,
  sendSmsWebhook,
  sendEmailWebhook,
  createTestConversation,
  getConversationWithMessages,
  expectValidConversation,
  expectValidMessage
} from '../utils/testHelpers';
import { prisma } from '../setup';

describe('Conversations API', () => {
  describe('GET /api/conversations', () => {
    beforeEach(async () => {
      // Create some test data
      await sendSmsMessage({
        from: '+12345678901',
        to: '+19876543210',
        body: 'First SMS message'
      });

      await sendEmailMessage({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        body: '<p>First email message</p>'
      });

      // Add some inbound messages
      await sendSmsWebhook({
        from: '+19876543210',
        to: '+12345678901',
        body: 'SMS reply'
      });

      await sendEmailWebhook({
        from: 'recipient@example.com',
        to: 'sender@example.com',
        body: '<p>Email reply</p>'
      });
    });

    it('should get conversations for a participant', async () => {
      const response = await testApp
        .get('/api/conversations')
        .query({ participant: '%2B12345678901' }) // URL encoded +12345678901
        .expect(200);

      expect(response.body).toMatchObject({
        conversations: expect.arrayContaining([
          expect.objectContaining({
            participant1: '+12345678901',
            participant2: '+19876543210',
            channelType: 'SMS',
            messageCount: expect.any(Number),
            lastMessage: expect.objectContaining({
              body: expect.any(String),
              direction: expect.any(String)
            })
          })
        ]),
        pagination: {
          page: 1,
          limit: 20,
          total: expect.any(Number),
          hasMore: false
        },
        filters: {
          participant: '+12345678901',
          channelType: null
        }
      });

      response.body.conversations.forEach(expectValidConversation);
    });

    it('should filter conversations by channel type', async () => {
      const smsResponse = await testApp
        .get('/api/conversations')
        .query({ 
          participant: '%2B12345678901',
          channelType: 'SMS'
        })
        .expect(200);

      const emailResponse = await testApp
        .get('/api/conversations')
        .query({
          participant: 'sender@example.com',
          channelType: 'EMAIL'
        })
        .expect(200);

      expect(smsResponse.body.conversations).toHaveLength(1);
      expect(smsResponse.body.conversations[0].channelType).toBe('SMS');

      expect(emailResponse.body.conversations).toHaveLength(1);
      expect(emailResponse.body.conversations[0].channelType).toBe('EMAIL');
    });

    it('should support pagination', async () => {
      // Create multiple conversations
      for (let i = 0; i < 5; i++) {
        await sendSmsMessage({
          from: '+12345678901',
          to: `+1987654321${i}`,
          body: `Message to ${i}`
        });
      }

      // Test pagination
      const page1Response = await testApp
        .get('/api/conversations')
        .query({
          participant: '%2B12345678901',
          page: 1,
          limit: 3
        })
        .expect(200);

      const page2Response = await testApp
        .get('/api/conversations')
        .query({
          participant: '%2B12345678901',
          page: 2,
          limit: 3
        })
        .expect(200);

      expect(page1Response.body.conversations).toHaveLength(3);
      expect(page1Response.body.pagination).toMatchObject({
        page: 1,
        limit: 3,
        total: 3,
        hasMore: true
      });

      expect(page2Response.body.conversations.length).toBeGreaterThan(0);
      expect(page2Response.body.pagination).toMatchObject({
        page: 2,
        limit: 3
      });

      // Ensure no duplicate conversations
      const page1Ids = page1Response.body.conversations.map((c: any) => c.id);
      const page2Ids = page2Response.body.conversations.map((c: any) => c.id);
      const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it('should return conversations in descending order by lastMessageAt', async () => {
      // Send messages with delays to ensure different timestamps
      await sendSmsMessage({
        from: '+12345678901',
        to: '+19876543211',
        body: 'First conversation'
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      await sendSmsMessage({
        from: '+12345678901',
        to: '+19876543212',
        body: 'Second conversation'
      });

      const response = await testApp
        .get('/api/conversations')
        .query({ participant: '%2B12345678901' })
        .expect(200);

      const conversations = response.body.conversations;
      expect(conversations.length).toBeGreaterThan(1);

      // Should be sorted by lastMessageAt descending
      for (let i = 0; i < conversations.length - 1; i++) {
        const current = new Date(conversations[i].lastMessageAt);
        const next = new Date(conversations[i + 1].lastMessageAt);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });

    it('should include last message preview', async () => {
      const longMessage = 'A'.repeat(150); // Longer than 100 chars
      
      await sendSmsMessage({
        from: '+12345678901',
        to: '+19876543210',
        body: longMessage
      });

      const response = await testApp
        .get('/api/conversations')
        .query({ participant: '%2B12345678901' })
        .expect(200);

      const conversation = response.body.conversations.find(
        (c: any) => c.participant2 === '+19876543210'
      );

      expect(conversation.lastMessage).toMatchObject({
        id: expect.any(String),
        from: '+12345678901',
        to: '+19876543210',
        type: 'SMS',
        body: longMessage.substring(0, 100) + '...', // Truncated
        direction: 'OUTBOUND',
        status: 'SENT',
        timestamp: expect.any(String)
      });
    });

    it('should handle bidirectional participants correctly', async () => {
      // Test that A->B and B->A queries return the same conversation
      const responseA = await testApp
        .get('/api/conversations')
        .query({ participant: '%2B12345678901' })
        .expect(200);

      const responseB = await testApp
        .get('/api/conversations')
        .query({ participant: '%2B19876543210' })
        .expect(200);

      const conversationA = responseA.body.conversations.find(
        (c: any) => c.participant2 === '+19876543210' || c.participant1 === '+19876543210'
      );

      const conversationB = responseB.body.conversations.find(
        (c: any) => c.participant2 === '+12345678901' || c.participant1 === '+12345678901'
      );

      expect(conversationA.id).toBe(conversationB.id);
      expect(conversationA.participant1).toBe(conversationB.participant1);
      expect(conversationA.participant2).toBe(conversationB.participant2);
    });

    it('should handle email participants correctly', async () => {
      const response = await testApp
        .get('/api/conversations')
        .query({ participant: 'sender@example.com' })
        .expect(200);

      expect(response.body.conversations).toHaveLength(1);
      expect(response.body.conversations[0]).toMatchObject({
        participant1: 'recipient@example.com', // Lexicographically first
        participant2: 'sender@example.com',
        channelType: 'EMAIL'
      });
    });

    it('should require participant parameter', async () => {
      const response = await testApp
        .get('/api/conversations')
        .expect(400);

      expect(response.body.error).toMatchObject({
        message: 'participant query parameter is required',
        code: 'VALIDATION_ERROR'
      });
    });

    it('should validate channel type parameter', async () => {
      const response = await testApp
        .get('/api/conversations')
        .query({
          participant: '%2B12345678901',
          channelType: 'INVALID'
        })
        .expect(400);

      expect(response.body.error).toMatchObject({
        message: 'Invalid channelType. Must be SMS or EMAIL',
        code: 'VALIDATION_ERROR'
      });
    });

    it('should handle URL encoding correctly', async () => {
      // Test with phone number that gets URL encoded by supertest
      const response = await testApp
        .get('/api/conversations')
        .query({ participant: '+12345678901' }) // Supertest will URL encode this
        .expect(200);

      // Should properly decode URL encoding and find conversations
      expect(response.body.conversations).toHaveLength(1);
      expect(response.body.filters.participant).toBe('+12345678901');
    });

    it('should return empty array when no conversations exist', async () => {
      const response = await testApp
        .get('/api/conversations')
        .query({ participant: '%2B19999999999' }) // Non-existent participant
        .expect(200);

      expect(response.body).toMatchObject({
        conversations: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          hasMore: false
        }
      });
    });
  });

  describe('GET /api/conversations/:id/messages', () => {
    let conversationId: string;

    beforeEach(async () => {
      // Create a conversation with multiple messages
      const smsResponse = await sendSmsMessage({
        from: '+12345678901',
        to: '+19876543210',
        body: 'First outbound message'
      });

      conversationId = smsResponse.body.message.conversationId;

      // Add more messages to the conversation
      await sendSmsWebhook({
        from: '+19876543210',
        to: '+12345678901',
        body: 'First inbound reply'
      });

      await sendSmsMessage({
        from: '+12345678901',
        to: '+19876543210',
        body: 'Second outbound message'
      });

      await sendSmsWebhook({
        from: '+19876543210',
        to: '+12345678901',
        body: 'Second inbound reply'
      });
    });

    it('should get messages for a conversation', async () => {
      const response = await testApp
        .get(`/api/conversations/${conversationId}/messages`)
        .expect(200);

      expect(response.body).toMatchObject({
        conversation: expect.objectContaining({
          id: conversationId,
          participant1: '+12345678901',
          participant2: '+19876543210',
          channelType: 'SMS',
          messageCount: expect.any(Number)
        }),
        messages: expect.arrayContaining([
          expect.objectContaining({
            direction: 'OUTBOUND',
            body: 'First outbound message'
          }),
          expect.objectContaining({
            direction: 'INBOUND',
            body: 'First inbound reply'
          })
        ]),
        pagination: {
          page: 1,
          limit: 50,
          total: expect.any(Number),
          hasMore: false
        }
      });

      expect(response.body.messages).toHaveLength(4);
      response.body.messages.forEach(expectValidMessage);
    });

    it('should support pagination for messages', async () => {
      // Create many messages
      for (let i = 0; i < 10; i++) {
        await sendSmsMessage({
          from: '+12345678901',
          to: '+19876543210',
          body: `Message ${i}`
        });
      }

      const page1Response = await testApp
        .get(`/api/conversations/${conversationId}/messages`)
        .query({ page: 1, limit: 5 })
        .expect(200);

      const page2Response = await testApp
        .get(`/api/conversations/${conversationId}/messages`)
        .query({ page: 2, limit: 5 })
        .expect(200);

      expect(page1Response.body.messages).toHaveLength(5);
      expect(page1Response.body.pagination).toMatchObject({
        page: 1,
        limit: 5,
        hasMore: true
      });

      expect(page2Response.body.messages.length).toBeGreaterThan(0);
      expect(page2Response.body.pagination.page).toBe(2);

      // Ensure no duplicate messages
      const page1Ids = page1Response.body.messages.map((m: any) => m.id);
      const page2Ids = page2Response.body.messages.map((m: any) => m.id);
      const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it('should return messages in chronological order', async () => {
      const response = await testApp
        .get(`/api/conversations/${conversationId}/messages`)
        .expect(200);

      const messages = response.body.messages;
      
      // Should be sorted by timestamp ascending (oldest first)
      for (let i = 0; i < messages.length - 1; i++) {
        const current = new Date(messages[i].timestamp);
        const next = new Date(messages[i + 1].timestamp);
        expect(current.getTime()).toBeLessThanOrEqual(next.getTime());
      }
    });

    it('should include full message content', async () => {
      const response = await testApp
        .get(`/api/conversations/${conversationId}/messages`)
        .expect(200);

      const message = response.body.messages[0];
      
      expect(message).toMatchObject({
        id: expect.any(String),
        from: expect.any(String),
        to: expect.any(String),
        type: expect.stringMatching(/^(SMS|MMS|EMAIL)$/),
        body: expect.any(String),
        attachments: expect.any(Array),
        direction: expect.stringMatching(/^(INBOUND|OUTBOUND)$/),
        status: expect.stringMatching(/^(PENDING|SENT|DELIVERED|FAILED|RECEIVED)$/),
        providerMessageId: expect.any(String),
        provider: expect.any(String),
        timestamp: expect.any(String),
        createdAt: expect.any(String)
      });
    });

    it('should handle non-existent conversation', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      
      const response = await testApp
        .get(`/api/conversations/${fakeId}/messages`)
        .expect(404);

      expect(response.body.error).toMatchObject({
        message: 'Conversation not found'
      });
    });

    it('should validate conversation ID format', async () => {
      const response = await testApp
        .get('/api/conversations/invalid-id/messages')
        .expect(400);

      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR'
      });
    });

    it('should handle empty conversations', async () => {
      // Create conversation with no messages
      const emptyConversation = await createTestConversation(
        '+15551234567',
        '+15559876543'
      );

      const response = await testApp
        .get(`/api/conversations/${emptyConversation.id}/messages`)
        .expect(200);

      expect(response.body.messages).toHaveLength(0);
      expect(response.body.pagination.total).toBe(0);
    });

    it('should respect pagination limits', async () => {
      // Test maximum limit enforcement (100)
      const response = await testApp
        .get(`/api/conversations/${conversationId}/messages`)
        .query({ limit: 200 }) // Above max
        .expect(200);

      expect(response.body.pagination.limit).toBe(100); // Should be capped

      // Test minimum limit enforcement (1)
      const response2 = await testApp
        .get(`/api/conversations/${conversationId}/messages`)
        .query({ limit: 0 }) // Below min
        .expect(200);

      expect(response2.body.pagination.limit).toBe(1); // Should be set to min
    });
  });

  describe('Error Handling', () => {
    it('should return proper error format for all endpoints', async () => {
      const response = await testApp
        .get('/api/conversations')
        .query({}) // Missing required parameter
        .expect(400);

      expect(response.body.error).toMatchObject({
        message: expect.any(String),
        code: expect.any(String),
        correlationId: expect.any(String)
      });

      expect(response.headers['x-correlation-id']).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      // This would require mocking Prisma for true database error simulation
      // For now, test that errors have proper structure
      const response = await testApp
        .get('/api/conversations/invalid-uuid-format/messages')
        .expect(400);

      expect(response.body.error.correlationId).toBeDefined();
    });
  });
});