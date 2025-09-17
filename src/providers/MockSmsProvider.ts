import crypto from 'crypto';
import { SmsMmsPayload, MockTwilioResponse, ProviderError, ISmsProvider } from './interfaces';

export class MockSmsProvider implements ISmsProvider {
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
    const now = new Date();

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
      date_created: now.toISOString(),
      date_updated: now.toISOString(),
      uri: `/2010-04-01/Accounts/ACmock1234567890abcdef1234567890/Messages/${sid}.json`
    };
  }

  private async simulateDelay(): Promise<void> {
    const delay = Math.random() * 400 + 100; // 100-500ms
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}