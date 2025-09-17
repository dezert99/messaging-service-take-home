import { prisma } from '../lib/prisma';
import { MessageType, MessageDirection, MessageStatus, ChannelType } from '@prisma/client';
import { determineMessageType, getChannelType } from '../utils/messageType';
import { findOrCreateConversation } from './conversationService';
import { MockSmsProvider, MockEmailProvider } from '../providers';
import { ProviderError as ProviderErrorInterface } from '../providers/interfaces';
import { SendSmsRequest, SendEmailRequest } from '../types/requests';
import { logger, logMessage, logError } from '../utils/logger';
import { DatabaseError, ProviderError } from '../middleware/errorHandler';

const smsProvider = new MockSmsProvider();
const emailProvider = new MockEmailProvider();

export async function sendSmsMessage(request: SendSmsRequest) {
  logger.info('Starting SMS message send', {
    from: request.from,
    to: request.to,
    type: request.type,
    hasAttachments: !!(request.attachments && request.attachments.length > 0)
  });

  try {
    const messageType = determineMessageType(request);
    const channelType = getChannelType(messageType);
    
    // Find or create conversation
    const conversation = await findOrCreateConversation(
      request.from,
      request.to,
      channelType
    );

    logger.debug('Conversation found/created', {
      conversationId: conversation.id,
      participants: [conversation.participant1, conversation.participant2]
    });

    // Create message record with PENDING status
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        from: request.from,
        to: request.to,
        type: messageType,
        body: request.body,
      attachments: request.attachments || [],
      direction: MessageDirection.OUTBOUND,
      status: MessageStatus.PENDING,
      timestamp: new Date(request.timestamp),
      provider: 'twilio'
    }
  });

  logMessage('created', message);

  try {
    // Send via provider
    logger.debug('Sending to SMS provider', {
      messageId: message.id,
      provider: 'twilio'
    });

    const response = await smsProvider.sendMessage({
      from: request.from,
      to: request.to,
      type: request.type,
      body: request.body,
      attachments: request.attachments,
      timestamp: request.timestamp,
      _forceError: request._forceError
    });

    // Update message with provider response
    const updatedMessage = await prisma.message.update({
      where: { id: message.id },
      data: {
        status: MessageStatus.SENT,
        providerMessageId: response.sid,
        metadata: {
          twilioResponse: JSON.parse(JSON.stringify(response))
        }
      }
    });

    logMessage('sent', updatedMessage);

    return {
      message: updatedMessage,
      providerResponse: response
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logError(error as Error, {
      context: 'SMS provider send',
      messageId: message.id,
      from: request.from,
      to: request.to
    });

    try {
      // Update message status to FAILED
      const failedMessage = await prisma.message.update({
        where: { id: message.id },
        data: {
          status: MessageStatus.FAILED,
        metadata: {
          error: {
            message: (error as Error).message,
            statusCode: (error as ProviderErrorInterface).statusCode
          }
        }
      }
    });

    logMessage('failed', failedMessage);

    // Re-throw with provider status code
    const providerError = error as ProviderErrorInterface;
    if (providerError.statusCode) {
      throw new ProviderError(providerError.message, 'twilio', providerError.statusCode?.toString());
    }
    
    throw error;
    
  } catch (dbError) {
    logError(dbError as Error, {
      context: 'Database update after SMS failure',
      messageId: message.id
    });
    throw new DatabaseError('Failed to update message status', 'message_update');
  }
}

} catch (error) {
  logError(error as Error, {
    context: 'SMS message creation',
    from: request.from,
    to: request.to
  });
  
  if (error instanceof Error && error.message.includes('Prisma')) {
    throw new DatabaseError('Failed to create message', 'message_create');
  }
  throw error;
}
}

export async function sendEmailMessage(request: SendEmailRequest) {
  logger.info('Starting email message send', {
    from: request.from,
    to: request.to,
    hasAttachments: !!(request.attachments && request.attachments.length > 0)
  });

  try {
    const messageType = MessageType.EMAIL;
    const channelType = ChannelType.EMAIL;
    
    // Find or create conversation
    const conversation = await findOrCreateConversation(
      request.from,
      request.to,
      channelType
    );

    logger.debug('Email conversation found/created', {
      conversationId: conversation.id,
      participants: [conversation.participant1, conversation.participant2]
    });

    // Create message record with PENDING status
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        from: request.from,
        to: request.to,
        type: messageType,
        body: request.body,
      attachments: request.attachments || [],
      direction: MessageDirection.OUTBOUND,
      status: MessageStatus.PENDING,
      timestamp: new Date(request.timestamp),
      provider: 'sendgrid'
    }
  });

  logMessage('created', message);

  try {
    // Send via provider
    logger.debug('Sending to email provider', {
      messageId: message.id,
      provider: 'sendgrid'
    });

    const response = await emailProvider.sendEmail({
      from: request.from,
      to: request.to,
      body: request.body,
      attachments: request.attachments,
      timestamp: request.timestamp,
      _forceError: request._forceError
    });

    // Update message with provider response
    const updatedMessage = await prisma.message.update({
      where: { id: message.id },
      data: {
        status: MessageStatus.SENT,
        providerMessageId: response.message_id,
        metadata: {
          sendGridResponse: JSON.parse(JSON.stringify(response))
        }
      }
    });

    logMessage('sent', updatedMessage);

    return {
      message: updatedMessage,
      providerResponse: response
    };

  } catch (error) {
    logError(error as Error, {
      context: 'Email provider send',
      messageId: message.id,
      from: request.from,
      to: request.to
    });

    try {
      // Update message status to FAILED
      const failedMessage = await prisma.message.update({
        where: { id: message.id },
        data: {
          status: MessageStatus.FAILED,
          metadata: {
          error: {
            message: (error as Error).message,
            statusCode: (error as ProviderErrorInterface).statusCode
          }
        }
      }
    });

    logMessage('failed', failedMessage);

    // Re-throw with provider status code
    const providerError = error as ProviderErrorInterface;
    if (providerError.statusCode) {
      throw new ProviderError(providerError.message, 'sendgrid', providerError.statusCode?.toString());
    }
    
    throw error;
    
  } catch (dbError) {
    logError(dbError as Error, {
      context: 'Database update after email failure',
      messageId: message.id
    });
    throw new DatabaseError('Failed to update message status', 'message_update');
  }
}

} catch (error) {
  logError(error as Error, {
    context: 'Email message creation',
    from: request.from,
    to: request.to
  });
  
  if (error instanceof Error && error.message.includes('Prisma')) {
    throw new DatabaseError('Failed to create message', 'message_create');
  }
  throw error;
}
}