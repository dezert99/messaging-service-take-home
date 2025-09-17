import { prisma } from '../lib/prisma';
import { MessageType, MessageDirection, MessageStatus, ChannelType } from '@prisma/client';
import { determineMessageType, getChannelType } from '../utils/messageType';
import { findOrCreateConversation } from './conversationService';
import { MockSmsProvider, MockEmailProvider, ProviderError } from '../providers';
import { SendSmsRequest, SendEmailRequest } from '../types/requests';
import { logger } from '../utils/logger';

const smsProvider = new MockSmsProvider();
const emailProvider = new MockEmailProvider();

export async function sendSmsMessage(request: SendSmsRequest) {
  const messageType = determineMessageType(request);
  const channelType = getChannelType(messageType);
  
  // Find or create conversation
  const conversation = await findOrCreateConversation(
    request.from,
    request.to,
    channelType
  );

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

  try {
    // Send via provider
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

    logger.info('SMS message sent successfully', {
      messageId: message.id,
      providerId: response.sid,
      from: request.from,
      to: request.to
    });

    return {
      message: updatedMessage,
      providerResponse: response
    };

  } catch (error) {
    // Update message status to FAILED
    const failedMessage = await prisma.message.update({
      where: { id: message.id },
      data: {
        status: MessageStatus.FAILED,
        metadata: {
          error: {
            message: (error as Error).message,
            statusCode: (error as ProviderError).statusCode
          }
        }
      }
    });

    logger.error('SMS message failed', {
      messageId: message.id,
      error: (error as Error).message,
      statusCode: (error as ProviderError).statusCode,
      from: request.from,
      to: request.to
    });

    // Re-throw with provider status code
    const providerError = error as ProviderError;
    if (providerError.statusCode) {
      const newError = new Error(providerError.message) as ProviderError;
      newError.statusCode = providerError.statusCode;
      throw newError;
    }
    
    throw error;
  }
}

export async function sendEmailMessage(request: SendEmailRequest) {
  const messageType = MessageType.EMAIL;
  const channelType = ChannelType.EMAIL;
  
  // Find or create conversation
  const conversation = await findOrCreateConversation(
    request.from,
    request.to,
    channelType
  );

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

  try {
    // Send via provider
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

    logger.info('Email message sent successfully', {
      messageId: message.id,
      providerId: response.message_id,
      from: request.from,
      to: request.to
    });

    return {
      message: updatedMessage,
      providerResponse: response
    };

  } catch (error) {
    // Update message status to FAILED
    const failedMessage = await prisma.message.update({
      where: { id: message.id },
      data: {
        status: MessageStatus.FAILED,
        metadata: {
          error: {
            message: (error as Error).message,
            statusCode: (error as ProviderError).statusCode
          }
        }
      }
    });

    logger.error('Email message failed', {
      messageId: message.id,
      error: (error as Error).message,
      statusCode: (error as ProviderError).statusCode,
      from: request.from,
      to: request.to
    });

    // Re-throw with provider status code
    const providerError = error as ProviderError;
    if (providerError.statusCode) {
      const newError = new Error(providerError.message) as ProviderError;
      newError.statusCode = providerError.statusCode;
      throw newError;
    }
    
    throw error;
  }
}