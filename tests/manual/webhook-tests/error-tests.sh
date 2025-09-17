#!/bin/bash

echo "🚨 Webhook Error Handling Tests"
echo "================================"
echo "Testing webhook resilience with various error scenarios"
echo ""

# Test 1: Invalid JSON
echo "1️⃣ Testing Invalid JSON..."
curl -X POST http://localhost:8080/api/webhooks/sms \
  -H "Content-Type: application/json" \
  -d '{"invalid": json}' \
  -w "\nHTTP Status: %{http_code}\n"
echo ""

# Test 2: Missing required fields
echo "2️⃣ Testing Missing Required Fields..."
curl -X POST http://localhost:8080/api/webhooks/sms \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+123"
  }' \
  -w "\nHTTP Status: %{http_code}\n"
echo ""

# Test 3: Invalid field types
echo "3️⃣ Testing Invalid Field Types..."
curl -X POST http://localhost:8080/api/webhooks/sms \
  -H "Content-Type: application/json" \
  -d '{
    "from": 12345,
    "to": "+19876543210",
    "type": "sms",
    "messaging_provider_id": "SM123",
    "body": 123,
    "timestamp": "invalid-date"
  }' \
  -w "\nHTTP Status: %{http_code}\n"
echo ""

# Test 4: Empty request body
echo "4️⃣ Testing Empty Request Body..."
curl -X POST http://localhost:8080/api/webhooks/sms \
  -H "Content-Type: application/json" \
  -d '' \
  -w "\nHTTP Status: %{http_code}\n"
echo ""

# Test 5: Wrong content type
echo "5️⃣ Testing Wrong Content Type..."
curl -X POST http://localhost:8080/api/webhooks/sms \
  -H "Content-Type: text/plain" \
  -d 'This is not JSON' \
  -w "\nHTTP Status: %{http_code}\n"
echo ""

# Test 6: Very large payload
echo "6️⃣ Testing Large Payload..."
LARGE_BODY=$(printf '%.0s' {1..2000})
curl -X POST http://localhost:8080/api/webhooks/sms \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+12345678901",
    "to": "+19876543210",
    "type": "sms",
    "messaging_provider_id": "SM_LARGE",
    "body": "'"$LARGE_BODY"'",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
  }' \
  -w "\nHTTP Status: %{http_code}\n"
echo ""

# Test 7: Duplicate SendGrid events (should handle gracefully)
echo "7️⃣ Testing Duplicate SendGrid Events..."
TIMESTAMP=$(date +%s)
EVENT_ID="duplicate_event_${TIMESTAMP}"

echo "Sending event first time..."
curl -X POST http://localhost:8080/api/webhooks/email/events \
  -H "Content-Type: application/json" \
  -d '[{
    "email": "test@example.com",
    "timestamp": '${TIMESTAMP}',
    "smtp-id": "<test@example.com>",
    "event": "delivered",
    "sg_event_id": "'${EVENT_ID}'",
    "sg_message_id": "test_message_'${TIMESTAMP}'"
  }]' \
  -w "\nHTTP Status: %{http_code}\n"

echo "Sending same event again (should be deduplicated)..."
curl -X POST http://localhost:8080/api/webhooks/email/events \
  -H "Content-Type: application/json" \
  -d '[{
    "email": "test@example.com",
    "timestamp": '${TIMESTAMP}',
    "smtp-id": "<test@example.com>",
    "event": "delivered",
    "sg_event_id": "'${EVENT_ID}'",
    "sg_message_id": "test_message_'${TIMESTAMP}'"
  }]' \
  -w "\nHTTP Status: %{http_code}\n"
echo ""

# Test 8: Status update for non-existent message
echo "8️⃣ Testing Status Update for Non-existent Message..."
curl -X POST http://localhost:8080/api/webhooks/sms/status \
  -H "Content-Type: application/json" \
  -d '{
    "MessageSid": "SM_NONEXISTENT_123456789",
    "MessageStatus": "delivered",
    "AccountSid": "ACtest123",
    "From": "+12345678901",
    "To": "+19876543210",
    "ApiVersion": "2010-04-01"
  }' \
  -w "\nHTTP Status: %{http_code}\n"
echo ""

echo "✅ Error handling tests completed!"
echo ""
echo "Expected behaviors:"
echo "- All requests should return HTTP 200 (webhooks should not fail)"
echo "- Invalid JSON/data should be handled gracefully"
echo "- Duplicate events should be ignored silently"
echo "- Non-existent message updates should not cause errors"
echo "- Check server logs to verify error handling is working correctly"