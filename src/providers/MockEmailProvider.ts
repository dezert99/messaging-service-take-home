import crypto from 'crypto';
import { EmailPayload, MockSendGridResponse, ProviderError, IEmailProvider } from './interfaces';

export class MockEmailProvider implements IEmailProvider {
  private generateMessageId(): string {
    const random = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    return `${random}.filter001.${timestamp}.0`;
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
    const delay = Math.random() * 400 + 100; // 100-500ms
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}