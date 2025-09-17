import { Request, Response, NextFunction } from 'express';
import { ChannelType } from '@prisma/client';
import { getUserConversations, getConversationById } from '../services/conversationService';
import { logger } from '../utils/logger';
import { ValidationError } from '../middleware/errorHandler';

interface ConversationQuery {
  page?: string;
  limit?: string;
  channelType?: string;
  participant?: string;
}

export async function getConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as ConversationQuery;
    
    // Parse pagination parameters
    const page = Math.max(1, parseInt(query.page || '1'));
    const limit = Math.max(1, parseInt(query.limit || '20'));
    const offset = (page - 1) * limit;
    
    // Parse and validate channel type filter
    let channelType: ChannelType | undefined;
    if (query.channelType) {
      if (!Object.values(ChannelType).includes(query.channelType as ChannelType)) {
        throw new ValidationError('Invalid channelType. Must be SMS or EMAIL');
      }
      channelType = query.channelType as ChannelType;
    }
    
    // Get participant filter (required for this endpoint)
    const participant = query.participant;
    if (!participant) {
      throw new ValidationError('participant query parameter is required');
    }
    
    logger.info('Fetching conversations', {
      participant,
      channelType,
      page,
      limit,
      offset
    });
    
    // Get conversations for the participant
    const conversations = await getUserConversations(
      participant,
      channelType,
      limit,
      offset
    );
    
    // Transform conversations for API response
    const transformedConversations = conversations.map(conv => ({
      id: conv.id,
      participant1: conv.participant1,
      participant2: conv.participant2,
      channelType: conv.channelType,
      lastMessageAt: conv.lastMessageAt,
      messageCount: conv._count?.messages || 0,
      lastMessage: conv.messages.length > 0 ? {
        id: conv.messages[0]!.id,
        from: conv.messages[0]!.from,
        to: conv.messages[0]!.to,
        type: conv.messages[0]!.type,
        body: conv.messages[0]!.body.substring(0, 100) + (conv.messages[0]!.body.length > 100 ? '...' : ''),
        direction: conv.messages[0]!.direction,
        status: conv.messages[0]!.status,
        timestamp: conv.messages[0]!.timestamp
      } : null,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt
    }));
    
    res.json({
      conversations: transformedConversations,
      pagination: {
        page,
        limit,
        total: transformedConversations.length,
        hasMore: transformedConversations.length === limit
      },
      filters: {
        participant,
        channelType: channelType || null
      }
    });
    
  } catch (error) {
    next(error);
  }
}

export async function getConversationMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const conversationId = req.params.id;
    
    if (!conversationId) {
      throw new ValidationError('Conversation ID is required');
    }
    
    // Parse pagination parameters
    const query = req.query as { page?: string; limit?: string };
    const page = Math.max(1, parseInt(query.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '50')));
    const offset = (page - 1) * limit;
    
    logger.info('Fetching conversation messages', {
      conversationId,
      page,
      limit,
      offset
    });
    
    // Get conversation with messages
    const conversation = await getConversationById(conversationId, limit, offset);
    
    if (!conversation) {
      res.status(404).json({
        error: 'Conversation not found'
      });
      return;
    }
    
    // Transform messages for API response
    const transformedMessages = conversation.messages.map(msg => ({
      id: msg.id,
      from: msg.from,
      to: msg.to,
      type: msg.type,
      body: msg.body,
      attachments: msg.attachments,
      direction: msg.direction,
      status: msg.status,
      providerMessageId: msg.providerMessageId,
      provider: msg.provider,
      timestamp: msg.timestamp,
      createdAt: msg.createdAt
    }));
    
    res.json({
      conversation: {
        id: conversation.id,
        participant1: conversation.participant1,
        participant2: conversation.participant2,
        channelType: conversation.channelType,
        lastMessageAt: conversation.lastMessageAt,
        messageCount: conversation._count?.messages || transformedMessages.length,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      },
      messages: transformedMessages,
      pagination: {
        page,
        limit,
        total: transformedMessages.length,
        hasMore: transformedMessages.length === limit
      }
    });
    
  } catch (error) {
    next(error);
  }
}