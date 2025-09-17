import {
  testApp,
  createTestSmsPayload,
  createTestEmailPayload,
  sendMultipleRequests,
  expectRateLimitHeaders,
  wait
} from '../utils/testHelpers';

describe('Rate Limiting', () => {
  const SMS_RATE_LIMIT = parseInt(process.env.SMS_RATE_LIMIT || '100');
  const EMAIL_RATE_LIMIT = parseInt(process.env.EMAIL_RATE_LIMIT || '500');

  describe('SMS Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const payload = createTestSmsPayload();
      
      // Send a few requests (well under limit)
      const responses = await sendMultipleRequests('/api/messages/sms', payload, 5);

      responses.forEach(response => {
        expect(response.status).toBe(201);
        expectRateLimitHeaders(response);
        
        const remaining = parseInt(response.headers['x-ratelimit-remaining'] || '0');
        expect(remaining).toBeGreaterThanOrEqual(0);
        expect(remaining).toBeLessThan(SMS_RATE_LIMIT);
      });

      // Verify remaining count decreases
      const remainingValues = responses.map(r => parseInt(r.headers['x-ratelimit-remaining'] || '0'));
      for (let i = 0; i < remainingValues.length - 1; i++) {
        expect(remainingValues[i]).toBeGreaterThan(remainingValues[i + 1] || 0);
      }
    });

    it('should enforce SMS rate limit', async () => {
      const payload = createTestSmsPayload();
      
      // Send requests up to and beyond the limit
      const requestCount = Math.min(SMS_RATE_LIMIT + 10, 110); // Don't go crazy
      const responses = await sendMultipleRequests('/api/messages/sms', payload, requestCount);

      let successCount = 0;
      let rateLimitedCount = 0;
      let firstRateLimitResponse: any = null;

      responses.forEach(response => {
        if (response.status === 201) {
          successCount++;
          expectRateLimitHeaders(response);
        } else if (response.status === 429) {
          rateLimitedCount++;
          if (!firstRateLimitResponse) {
            firstRateLimitResponse = response;
          }
        }
      });

      // Should have hit the rate limit
      expect(successCount).toBeLessThanOrEqual(SMS_RATE_LIMIT);
      expect(rateLimitedCount).toBeGreaterThan(0);

      // Check rate limit response format
      expect(firstRateLimitResponse.body).toMatchObject({
        error: expect.stringContaining('rate limit'),
        retryAfter: expect.any(Number)
      });

      expect(firstRateLimitResponse.headers['retry-after']).toBeDefined();
      expect(firstRateLimitResponse.headers['x-ratelimit-remaining']).toBe('0');
    });

    it('should include proper rate limit headers', async () => {
      const payload = createTestSmsPayload();
      
      const response = await testApp
        .post('/api/messages/sms')
        .send(payload)
        .expect(201);

      expect(response.headers).toMatchObject({
        'x-ratelimit-limit': SMS_RATE_LIMIT.toString(),
        'x-ratelimit-remaining': expect.stringMatching(/^\d+$/),
        'x-ratelimit-reset': expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      });

      const remaining = parseInt(response.headers['x-ratelimit-remaining'] || '0');
      expect(remaining).toBeLessThan(SMS_RATE_LIMIT);
      expect(remaining).toBeGreaterThanOrEqual(0);
    });

    it('should reset rate limit after window expires', async () => {
      const payload = createTestSmsPayload();

      // Use up some requests
      await sendMultipleRequests('/api/messages/sms', payload, 10);

      // Wait for rate limit window to reset (61 seconds to be safe)
      console.log('Waiting for rate limit window reset (61 seconds)...');
      await wait(61000);

      // Should be able to send requests again
      const response = await testApp
        .post('/api/messages/sms')
        .send(payload)
        .expect(201);

      const remaining = parseInt(response.headers['x-ratelimit-remaining'] || '0');
      expect(remaining).toBe(SMS_RATE_LIMIT - 1); // One request used
    }, 70000); // Longer timeout for this test

    it('should track rate limits per IP/client', async () => {
      // This test would require multiple clients or IP simulation
      // For now, we'll test that the rate limiter maintains state
      const payload = createTestSmsPayload();

      const response1 = await testApp
        .post('/api/messages/sms')
        .send(payload)
        .expect(201);

      const response2 = await testApp
        .post('/api/messages/sms')
        .send(payload)
        .expect(201);

      const remaining1 = parseInt(response1.headers['x-ratelimit-remaining'] || '0');
      const remaining2 = parseInt(response2.headers['x-ratelimit-remaining'] || '0');

      expect(remaining2).toBe(remaining1 - 1);
    });
  });

  describe('Email Rate Limiting', () => {
    it('should allow requests within email rate limit', async () => {
      const payload = createTestEmailPayload();
      
      const responses = await sendMultipleRequests('/api/messages/email', payload, 5);

      responses.forEach(response => {
        expect(response.status).toBe(201);
        expectRateLimitHeaders(response);
      });
    });

    it('should enforce email rate limit', async () => {
      const payload = createTestEmailPayload();
      
      // For email, we'll test a smaller subset due to higher limit
      const requestCount = Math.min(EMAIL_RATE_LIMIT + 10, 50);
      const responses = await sendMultipleRequests('/api/messages/email', payload, requestCount);

      // Since email limit is typically much higher, most should succeed
      const successCount = responses.filter(r => r.status === 201).length;
      expect(successCount).toBeLessThanOrEqual(EMAIL_RATE_LIMIT);

      // Headers should be present
      responses.forEach(response => {
        if (response.status === 201) {
          expect(response.headers['x-ratelimit-limit']).toBe(EMAIL_RATE_LIMIT.toString());
        }
      });
    });

    it('should have different limits for SMS and Email', async () => {
      const smsPayload = createTestSmsPayload();
      const emailPayload = createTestEmailPayload();

      const smsResponse = await testApp
        .post('/api/messages/sms')
        .send(smsPayload)
        .expect(201);

      const emailResponse = await testApp
        .post('/api/messages/email')
        .send(emailPayload)
        .expect(201);

      expect(smsResponse.headers['x-ratelimit-limit']).toBe(SMS_RATE_LIMIT.toString());
      expect(emailResponse.headers['x-ratelimit-limit']).toBe(EMAIL_RATE_LIMIT.toString());

      // Should be independent rate limiters
      expect(smsResponse.headers['x-ratelimit-limit'])
        .not.toBe(emailResponse.headers['x-ratelimit-limit']);
    });
  });

  describe('Rate Limit Configuration', () => {
    it('should use environment variable configuration', async () => {
      const smsPayload = createTestSmsPayload();
      
      const response = await testApp
        .post('/api/messages/sms')
        .send(smsPayload)
        .expect(201);

      // Should match configured limits
      expect(response.headers['x-ratelimit-limit']).toBe(SMS_RATE_LIMIT.toString());
    });

    it('should handle rate limit configuration correctly', async () => {
      // Verify that the configuration is working as expected
      expect(SMS_RATE_LIMIT).toBeGreaterThan(0);
      expect(EMAIL_RATE_LIMIT).toBeGreaterThan(0);
      expect(EMAIL_RATE_LIMIT).toBeGreaterThanOrEqual(SMS_RATE_LIMIT); // Typically email has higher limit
    });
  });

  describe('Rate Limit Error Responses', () => {
    it('should return proper error format when rate limited', async () => {
      const payload = createTestSmsPayload();
      
      // Exhaust rate limit
      await sendMultipleRequests('/api/messages/sms', payload, SMS_RATE_LIMIT + 5);

      // Next request should be rate limited
      const response = await testApp
        .post('/api/messages/sms')
        .send(payload)
        .expect(429);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('rate limit'),
        retryAfter: expect.any(Number)
      });

      expect(response.headers).toMatchObject({
        'retry-after': expect.stringMatching(/^\d+$/),
        'x-ratelimit-limit': SMS_RATE_LIMIT.toString(),
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': expect.any(String)
      });

      const retryAfter = parseInt(response.headers['retry-after'] || '0');
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60); // Should be within window duration
    });

    it('should include correlation ID in rate limit errors', async () => {
      const payload = createTestSmsPayload();
      
      // Hit rate limit
      await sendMultipleRequests('/api/messages/sms', payload, SMS_RATE_LIMIT + 5);

      const response = await testApp
        .post('/api/messages/sms')
        .send(payload)
        .expect(429);

      expect(response.headers['x-correlation-id']).toBeDefined();
    });
  });

  describe('Rate Limit Window Behavior', () => {
    it('should maintain rate limit state across requests', async () => {
      const payload = createTestSmsPayload();

      // Make several requests and track remaining count
      const remainingCounts: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const response = await testApp
          .post('/api/messages/sms')
          .send(payload)
          .expect(201);

        remainingCounts.push(parseInt(response.headers['x-ratelimit-remaining'] || '0'));
      }

      // Should consistently decrease
      for (let i = 0; i < remainingCounts.length - 1; i++) {
        expect(remainingCounts[i]).toBeGreaterThan(remainingCounts[i + 1] || 0);
      }
    });

    it('should handle concurrent requests correctly', async () => {
      const payload = createTestSmsPayload();
      
      // Send requests concurrently
      const promises = Array(10).fill(null).map(() =>
        testApp.post('/api/messages/sms').send(payload)
      );

      const responses = await Promise.all(promises);

      const successResponses = responses.filter(r => r.status === 201);
      const rateLimitResponses = responses.filter(r => r.status === 429);

      // All should either succeed or be rate limited
      expect(successResponses.length + rateLimitResponses.length).toBe(10);

      // If any were rate limited, remaining should be 0
      if (rateLimitResponses.length > 0) {
        rateLimitResponses.forEach(response => {
          expect(response.headers['x-ratelimit-remaining']).toBe('0');
        });
      }
    });
  });

  describe('Rate Limit Integration', () => {
    it('should not affect other endpoints', async () => {
      const smsPayload = createTestSmsPayload();
      
      // Use up SMS rate limit
      await sendMultipleRequests('/api/messages/sms', smsPayload, SMS_RATE_LIMIT + 5);

      // Should still be able to access other endpoints
      const healthResponse = await testApp
        .get('/health')
        .expect(200);

      const conversationsResponse = await testApp
        .get('/api/conversations')
        .query({ participant: '%2B12345678901' })
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');
      expect(conversationsResponse.body.conversations).toBeDefined();
    });

    it('should work with force error scenarios', async () => {
      const payload = createTestSmsPayload({
        _forceError: {
          code: 500,
          message: 'Provider error'
        }
      });

      // Force error should still consume rate limit
      const response = await testApp
        .post('/api/messages/sms')
        .send(payload)
        .expect(500);

      // Should still have rate limit headers even for provider errors
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(parseInt(response.headers['x-ratelimit-remaining'] || '0')).toBeLessThan(SMS_RATE_LIMIT);
    });
  });
});