import { MessageType, ChannelType } from '@prisma/client';

/**
 * Determine message type based on payload characteristics
 */
export function determineMessageType(payload: any): MessageType {
  if (payload.type === 'email' || payload.from.includes('@')) {
    return MessageType.EMAIL;
  } else if (payload.type === 'mms' || (payload.attachments && payload.attachments.length > 0)) {
    return MessageType.MMS;
  } else {
    return MessageType.SMS;
  }
}

/**
 * Get the channel type based on message type
 */
export function getChannelType(messageType: MessageType): ChannelType {
  return messageType === MessageType.EMAIL ? ChannelType.EMAIL : ChannelType.SMS;
}