# Webhook Testing Suite

Comprehensive tests for all webhook endpoints and scenarios.

## Prerequisites

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Ensure database is running and migrated:**
   ```bash
   npm run migrate
   ```

## Test Files

### Individual Endpoint Tests

- **`test-inbound-sms.sh`** - Test inbound SMS webhook
- **`test-inbound-mms.sh`** - Test inbound MMS webhook with attachments
- **`test-inbound-email.sh`** - Test inbound email webhook with HTML content
- **`test-twilio-status.sh`** - Test Twilio status update webhook
- **`test-sendgrid-events.sh`** - Test SendGrid events webhook with multiple events

### Comprehensive Tests

- **`test-comprehensive.ts`** - Full TypeScript test suite with detailed reporting
- **`full-workflow-test.sh`** - Complete integration test simulating real conversation flow
- **`error-tests.sh`** - Error handling and edge case testing

## Usage

### Quick Individual Tests

```bash
# Make scripts executable
chmod +x tests/manual/webhook-tests/*.sh

# Test individual endpoints
./tests/manual/webhook-tests/test-inbound-sms.sh
./tests/manual/webhook-tests/test-inbound-email.sh
```

### Full Integration Test

```bash
# Run the complete workflow test
./tests/manual/webhook-tests/full-workflow-test.sh
```

This test will:
1. Send an outbound SMS message
2. Update its status via Twilio webhook
3. Receive an inbound reply
4. Send another inbound message to verify conversation reuse
5. Provide SQL queries to verify conversation linking

### Comprehensive TypeScript Test

```bash
# Run the comprehensive test suite
npx ts-node tests/manual/webhook-tests/test-comprehensive.ts
```

### Error Handling Tests

```bash
# Test error scenarios
./tests/manual/webhook-tests/error-tests.sh
```

## Verification Steps

After running tests, verify the results:

### 1. Check Database Records

```sql
-- View recent conversations
SELECT * FROM "Conversation" ORDER BY "createdAt" DESC LIMIT 5;

-- View recent messages
SELECT id, "from", "to", direction, status, type, body, "providerMessageId", "createdAt"
FROM "Message" ORDER BY "createdAt" DESC LIMIT 10;

-- Check processed events (SendGrid deduplication)
SELECT * FROM "ProcessedEvent" ORDER BY "processedAt" DESC LIMIT 10;
```

### 2. Check Message Status Updates

```sql
-- View messages with status updates in metadata
SELECT id, status, "providerMessageId", metadata
FROM "Message" 
WHERE metadata IS NOT NULL 
ORDER BY "updatedAt" DESC LIMIT 5;
```

### 3. Verify Conversation Linking

```sql
-- Check that bidirectional messages are in same conversation
SELECT 
  c.id as conversation_id,
  c.participant1,
  c.participant2,
  c."channelType",
  COUNT(m.id) as message_count,
  STRING_AGG(m.direction::text, ', ') as directions
FROM "Conversation" c
LEFT JOIN "Message" m ON c.id = m."conversationId"
GROUP BY c.id, c.participant1, c.participant2, c."channelType"
ORDER BY c."createdAt" DESC
LIMIT 5;
```

## Expected Results

### Successful Webhook Responses
- All webhook endpoints should return **HTTP 200**
- Inbound messages should create new conversation or link to existing one
- Status updates should modify existing message status
- SendGrid events should be deduplicated

### Database Changes
- **Conversations**: Created with normalized participants (lexicographically sorted)
- **Messages**: 
  - Inbound messages have `direction = 'INBOUND'` and `status = 'RECEIVED'`
  - Status updates change existing message status
  - Metadata contains webhook payloads and status history
- **ProcessedEvents**: SendGrid event IDs to prevent duplicates

### Error Handling
- Invalid JSON/data should not crash server
- Missing message IDs should be handled gracefully
- Duplicate events should be silently ignored
- All webhook responses should be HTTP 200 (even for errors)

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Check if PostgreSQL is running
   brew services list | grep postgres
   
   # Run migration if needed
   npm run migrate
   ```

2. **Server Not Running**
   ```bash
   # Start development server
   npm run dev
   ```

3. **Permission Denied on Scripts**
   ```bash
   chmod +x tests/manual/webhook-tests/*.sh
   ```

### Check Server Logs

Monitor the server output for error messages and successful webhook processing logs. Look for:
- `"Inbound SMS/MMS received"`
- `"Twilio status update processed"`
- `"SendGrid event processed"`
- Any error messages

### Manual Testing with Postman

Import the test requests into Postman for interactive testing:

1. Create a new collection
2. Set base URL variable: `http://localhost:8080`
3. Add requests from the test files
4. Verify responses and database changes