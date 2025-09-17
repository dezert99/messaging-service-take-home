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

export interface ISmsProvider {
  sendMessage(payload: SmsMmsPayload): Promise<MockTwilioResponse>;
}

export interface IEmailProvider {
  sendEmail(payload: EmailPayload): Promise<MockSendGridResponse>;
}