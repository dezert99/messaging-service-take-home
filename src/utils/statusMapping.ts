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

export function mapSendGridEvent(eventType: string): MessageStatus | null {
  const eventMap: Record<string, MessageStatus> = {
    'processed': MessageStatus.SENT,
    'delivered': MessageStatus.DELIVERED,
    'bounce': MessageStatus.FAILED,
    'dropped': MessageStatus.FAILED,
    'deferred': MessageStatus.PENDING
  };
  
  // Return null for events we don't want to update message status for (open, click, etc.)
  return eventMap[eventType] || null;
}