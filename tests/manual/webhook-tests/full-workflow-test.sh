#!/bin/bash

echo "🔄 Full Webhook Integration Test"
echo "================================"
echo "This test simulates a complete message conversation workflow:"
echo "1. Send outbound SMS"
echo "2. Update status via webhook"
echo "3. Receive inbound reply"
echo "4. Get conversation to verify everything is linked"
echo ""

# Step 1: Send outbound SMS
echo "📤 Step 1: Sending outbound SMS..."
SMS_RESPONSE=$(curl -s -X POST http://localhost:8080/api/messages/sms \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+12345678901",
    "to": "+19876543210",
    "type": "sms",
    "body": "Hello, how are you doing today?",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
  }')

echo "Response: $SMS_RESPONSE"

# Extract provider message ID and conversation ID
PROVIDER_ID=$(echo $SMS_RESPONSE | grep -o '"providerMessageId":"[^"]*"' | cut -d'"' -f4)
CONVERSATION_ID=$(echo $SMS_RESPONSE | grep -o '"conversationId":"[^"]*"' | cut -d'"' -f4)

echo "Provider Message ID: $PROVIDER_ID"
echo "Conversation ID: $CONVERSATION_ID"
echo ""

if [ -z "$PROVIDER_ID" ]; then
  echo "❌ Failed to get provider message ID. Check if server is running and database is connected."
  exit 1
fi

# Step 2: Update status via Twilio webhook
echo "📊 Step 2: Updating message status via Twilio webhook..."
STATUS_RESPONSE=$(curl -s -X POST http://localhost:8080/api/webhooks/sms/status \
  -H "Content-Type: application/json" \
  -d '{
    "MessageSid": "'$PROVIDER_ID'",
    "MessageStatus": "delivered",
    "AccountSid": "ACmock1234567890abcdef1234567890",
    "From": "+12345678901",
    "To": "+19876543210",
    "ApiVersion": "2010-04-01"
  }')

echo "Status: $STATUS_RESPONSE"
echo ""

# Step 3: Send inbound reply
echo "📥 Step 3: Receiving inbound SMS reply..."
INBOUND_RESPONSE=$(curl -s -X POST http://localhost:8080/api/webhooks/sms \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+19876543210",
    "to": "+12345678901",
    "type": "sms",
    "messaging_provider_id": "SM_INBOUND_'$(date +%s)'",
    "body": "I am doing great, thanks for asking! How about you?",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
  }')

echo "Response: $INBOUND_RESPONSE"
echo ""

# Step 4: Get conversation to verify everything is linked
echo "💬 Step 4: Retrieving conversation via API..."

# Get conversations for the participant
echo "Getting conversations for +12345678901..."
CONVERSATIONS_RESPONSE=$(curl -s "http://localhost:8080/api/conversations?participant=%2B12345678901")
echo "Conversations response: $CONVERSATIONS_RESPONSE"
echo ""

# Get messages for the specific conversation
if [ ! -z "$CONVERSATION_ID" ]; then
  echo "Getting messages for conversation $CONVERSATION_ID..."
  MESSAGES_RESPONSE=$(curl -s "http://localhost:8080/api/conversations/$CONVERSATION_ID/messages")
  echo "Messages response: $MESSAGES_RESPONSE"
  echo ""
fi

echo "📋 You can also verify with these SQL queries:"
echo ""
echo "-- Check the conversation:"
echo "SELECT * FROM \"Conversation\" WHERE id = '$CONVERSATION_ID';"
echo ""
echo "-- Check all messages in this conversation:"
echo "SELECT id, \"from\", \"to\", direction, status, body, \"providerMessageId\", \"createdAt\""
echo "FROM \"Message\" WHERE \"conversationId\" = '$CONVERSATION_ID' ORDER BY \"createdAt\";"
echo ""

# Additional test: Send another inbound message to verify conversation reuse
echo "🔄 Step 5: Sending another message to verify conversation reuse..."
SECOND_INBOUND=$(curl -s -X POST http://localhost:8080/api/webhooks/sms \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+19876543210",
    "to": "+12345678901",
    "type": "sms",
    "messaging_provider_id": "SM_INBOUND_'$(date +%s)'_2",
    "body": "By the way, did you get my previous message?",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
  }')

echo "Second inbound response: $SECOND_INBOUND"
echo ""

echo "✅ Full workflow test completed!"
echo ""
echo "Expected results:"
echo "- 1 conversation with ID: $CONVERSATION_ID"
echo "- 3 messages total (1 outbound, 2 inbound)"
echo "- Outbound message should have status 'DELIVERED'"
echo "- Inbound messages should have status 'RECEIVED'"
echo "- All messages should be linked to the same conversation"