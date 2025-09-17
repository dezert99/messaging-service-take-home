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

export async function getUserConversations(userIdentifier: string, channelType?: ChannelType) {
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
    include: {
      messages: {
        take: 1,
        orderBy: {
          timestamp: 'desc'
        }
      }
    }
  });
}

export async function getConversationById(conversationId: string) {
  return await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: {
          timestamp: 'asc'
        }
      }
    }
  });
}