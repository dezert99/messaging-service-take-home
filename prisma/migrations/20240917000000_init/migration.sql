-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('SMS', 'MMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'RECEIVED');

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "participant1" TEXT NOT NULL,
    "participant2" TEXT NOT NULL,
    "channelType" "ChannelType" NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "type" "MessageType" NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" TEXT[],
    "direction" "MessageDirection" NOT NULL,
    "status" "MessageStatus" NOT NULL,
    "providerMessageId" TEXT,
    "provider" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedEvent" (
    "id" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conversation_participant1_participant2_channelType_idx" ON "Conversation"("participant1", "participant2", "channelType");

-- CreateIndex
CREATE INDEX "Conversation_participant1_channelType_idx" ON "Conversation"("participant1", "channelType");

-- CreateIndex
CREATE INDEX "Conversation_participant2_channelType_idx" ON "Conversation"("participant2", "channelType");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_participant1_participant2_channelType_key" ON "Conversation"("participant1", "participant2", "channelType");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_from_to_idx" ON "Message"("from", "to");

-- CreateIndex
CREATE INDEX "Message_providerMessageId_idx" ON "Message"("providerMessageId");

-- CreateIndex
CREATE INDEX "Message_timestamp_idx" ON "Message"("timestamp");

-- CreateIndex
CREATE INDEX "ProcessedEvent_processedAt_idx" ON "ProcessedEvent"("processedAt");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;