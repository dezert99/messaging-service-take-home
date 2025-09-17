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