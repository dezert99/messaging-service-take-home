import { prisma } from '../lib/prisma';
import { ChannelType } from '@prisma/client';
import { normalizeParticipants } from '../utils/participants';

export async function findOrCreateConversation(
  from: string, 
  to: string, 
  channelType: ChannelType
) {
  const [participant1, participant2] = normalizeParticipants(from, to);
  
  return await prisma.conversation.upsert({
    where: {
      participant1_participant2_channelType: {
        participant1,
        participant2,
        channelType
      }
    },
    create: {
      participant1,
      participant2,
      channelType,
      lastMessageAt: new Date()
    },
    update: {
      lastMessageAt: new Date()
    }
  });
}

export async function getUserConversations(
  userIdentifier: string, 
  channelType?: ChannelType,
  limit: number = 20,
  offset: number = 0
) {
  return await prisma.conversation.findMany({
    where: {
      AND: [
        {
          OR: [
            { participant1: userIdentifier },
            { participant2: userIdentifier }
          ]
        },
        channelType ? { channelType } : {}
      ]
    },
    orderBy: {
      lastMessageAt: 'desc'
    },
    take: limit,
    skip: offset,
    include: {
      messages: {
        take: 1,
        orderBy: {
          timestamp: 'desc'
        }
      },
      _count: {
        select: {
          messages: true
        }
      }
    }
  });
}

export async function getConversationById(
  conversationId: string,
  limit: number = 50,
  offset: number = 0
) {
  return await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: {
          timestamp: 'asc'
        },
        take: limit,
        skip: offset
      },
      _count: {
        select: {
          messages: true
        }
      }
    }
  });
}