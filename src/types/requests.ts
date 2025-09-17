export interface SendSmsRequest {
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

export interface SendEmailRequest {
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