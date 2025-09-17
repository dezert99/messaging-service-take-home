import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { MessageStatus, MessageDirection, MessageType, ChannelType } from '@prisma/client';
import { 
  InboundSmsWebhook, 
  InboundEmailWebhook, 
  TwilioStatusWebhook, 
  SendGridEventWebhook 
} from '../types/webhooks';
import { mapTwilioStatus, mapSendGridEvent } from '../utils/statusMapping';
import { determineMessageType, getChannelType } from '../utils/messageType';
import { findOrCreateConversation } from '../services/conversationService';
import { logger } from '../utils/logger';

export async function handleInboundSms(req: Request, res: Response): Promise<void> {
  const webhook: InboundSmsWebhook = req.body;
  
  try {
    // Check for duplicate webhook by provider message ID
    const existingMessage = await prisma.message.findFirst({
      where: { providerMessageId: webhook.messaging_provider_id }
    });
    
    if (existingMessage) {
      logger.info('Duplicate webhook received, ignoring', {
        providerMessageId: webhook.messaging_provider_id,
        existingMessageId: existingMessage.id
      });
      res.status(200).send('OK');
      return;
    }
    
    const messageType = determineMessageType(webhook);
    const channelType = getChannelType(messageType);
    
    // Find or create conversation
    const conversation = await findOrCreateConversation(
      webhook.from,
      webhook.to,
      channelType
    );

    // Create inbound message
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        from: webhook.from,
        to: webhook.to,
        type: messageType,
        body: webhook.body,
        attachments: webhook.attachments || [],
        direction: MessageDirection.INBOUND,
        status: MessageStatus.RECEIVED,
        providerMessageId: webhook.messaging_provider_id,
        provider: 'twilio',
        timestamp: new Date(webhook.timestamp),
        metadata: {
          webhookPayload: JSON.parse(JSON.stringify(webhook))
        }
      }
    });

    logger.info('Inbound SMS/MMS received', {
      messageId: message.id,
      conversationId: conversation.id,
      from: webhook.from,
      to: webhook.to,
      type: webhook.type
    });

    // Always return 200 for webhooks
    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error processing inbound SMS webhook', {
      error: (error as Error).message,
      webhook
    });
    
    // Return 200 even on error - webhooks should not retry for processing errors
    res.status(200).send('OK');
  }
}

export async function handleInboundEmail(req: Request, res: Response): Promise<void> {
  const webhook: InboundEmailWebhook = req.body;
  
  try {
    // Check for duplicate webhook by provider message ID
    const existingMessage = await prisma.message.findFirst({
      where: { providerMessageId: webhook.xillio_id }
    });
    
    if (existingMessage) {
      logger.info('Duplicate email webhook received, ignoring', {
        providerMessageId: webhook.xillio_id,
        existingMessageId: existingMessage.id
      });
      res.status(200).send('OK');
      return;
    }
    
    const messageType = MessageType.EMAIL;
    const channelType = ChannelType.EMAIL;
    
    // Find or create conversation
    const conversation = await findOrCreateConversation(
      webhook.from,
      webhook.to,
      channelType
    );

    // Create inbound message
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        from: webhook.from,
        to: webhook.to,
        type: messageType,
        body: webhook.body,
        attachments: webhook.attachments || [],
        direction: MessageDirection.INBOUND,
        status: MessageStatus.RECEIVED,
        providerMessageId: webhook.xillio_id,
        provider: 'sendgrid',
        timestamp: new Date(webhook.timestamp),
        metadata: {
          webhookPayload: JSON.parse(JSON.stringify(webhook))
        }
      }
    });

    logger.info('Inbound email received', {
      messageId: message.id,
      conversationId: conversation.id,
      from: webhook.from,
      to: webhook.to
    });

    // Always return 200 for webhooks
    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error processing inbound email webhook', {
      error: (error as Error).message,
      webhook
    });
    
    // Return 200 even on error
    res.status(200).send('OK');
  }
}

export async function handleTwilioStatusWebhook(req: Request, res: Response): Promise<void> {
  const webhook: TwilioStatusWebhook = req.body;
  
  try {
    // Find message by Twilio's MessageSid
    const message = await prisma.message.findFirst({
      where: { providerMessageId: webhook.MessageSid }
    });
    
    if (!message) {
      // Twilio expects 200 even if we don't have the message
      logger.warn('Message not found for Twilio status update', {
        messageSid: webhook.MessageSid,
        status: webhook.MessageStatus
      });
      res.status(200).send('OK');
      return;
    }
    
    // Map Twilio status to our status
    const newStatus = mapTwilioStatus(webhook.MessageStatus);
    
    // Prepare metadata update
    const metadata: any = {
      ...(message.metadata as any || {}),
      statusUpdates: [
        ...((message.metadata as any)?.statusUpdates || []),
        {
          status: webhook.MessageStatus,
          timestamp: new Date().toISOString(),
          ...(webhook.ErrorCode && {
            errorCode: webhook.ErrorCode,
            errorMessage: webhook.ErrorMessage
          })
        }
      ]
    };
    
    // Update message status
    await prisma.message.update({
      where: { id: message.id },
      data: { 
        status: newStatus,
        metadata
      }
    });
    
    logger.info('Twilio status update processed', {
      messageId: message.id,
      messageSid: webhook.MessageSid,
      oldStatus: message.status,
      newStatus,
      twilioStatus: webhook.MessageStatus
    });
    
    // Twilio expects 200 OK or 204 No Content
    res.status(200).send('OK');
  } catch (error) {
    logger.error('Twilio webhook error', {
      error: (error as Error).message,
      webhook
    });
    // Twilio will retry on 5xx errors
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function handleSendGridEventWebhook(req: Request, res: Response): Promise<void> {
  // SendGrid sends an array of events
  const events: SendGridEventWebhook[] = req.body;
  
  try {
    // Process each event
    for (const event of events) {
      // Skip if we've already processed this event (deduplication)
      const existing = await prisma.processedEvent.findUnique({
        where: { id: event.sg_event_id }
      });
      
      if (existing) {
        logger.debug('Duplicate SendGrid event skipped', {
          eventId: event.sg_event_id,
          messageId: event.sg_message_id
        });
        continue;
      }
      
      // Find message by SendGrid's message ID
      const message = await prisma.message.findFirst({
        where: { providerMessageId: event.sg_message_id }
      });
      
      if (!message) {
        logger.warn('Message not found for SendGrid event', {
          eventId: event.sg_event_id,
          messageId: event.sg_message_id,
          event: event.event
        });
        
        // Mark event as processed even if message not found
        await prisma.processedEvent.create({
          data: { id: event.sg_event_id }
        });
        continue;
      }
      
      // Get new status from event type
      const newStatus = mapSendGridEvent(event.event);
      
      // Prepare metadata update
      const metadata: any = {
        ...(message.metadata as any || {}),
        sendGridEvents: [
          ...((message.metadata as any)?.sendGridEvents || []),
          {
            event: event.event,
            timestamp: new Date(event.timestamp * 1000).toISOString(),
            eventId: event.sg_event_id,
            ...(event.reason && { reason: event.reason }),
            ...(event.response && { response: event.response })
          }
        ]
      };
      
      // Update message status if we have a mapping for this event
      if (newStatus !== null) {
        await prisma.message.update({
          where: { id: message.id },
          data: { 
            status: newStatus,
            metadata
          }
        });
        
        logger.info('SendGrid event processed with status update', {
          messageId: message.id,
          eventId: event.sg_event_id,
          event: event.event,
          oldStatus: message.status,
          newStatus
        });
      } else {
        // Update metadata only (for events like 'open', 'click')
        await prisma.message.update({
          where: { id: message.id },
          data: { metadata }
        });
        
        logger.info('SendGrid event processed (metadata only)', {
          messageId: message.id,
          eventId: event.sg_event_id,
          event: event.event
        });
      }
      
      // Mark event as processed
      await prisma.processedEvent.create({
        data: { id: event.sg_event_id }
      });
    }
    
    // SendGrid expects 200 OK
    res.status(200).send('OK');
  } catch (error) {
    logger.error('SendGrid webhook error', {
      error: (error as Error).message,
      eventsCount: events.length
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}