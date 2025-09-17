#!/bin/bash

echo "📊 Testing Twilio Status Webhook..."
echo "Note: This will only work if you have a message with MessageSid 'SM1234567890abcdef'"
echo "Send an SMS first, then use the returned SID here"

curl -X POST http://localhost:8080/api/webhooks/sms/status \
  -H "Content-Type: application/json" \
  -d '{
    "MessageSid": "SM1234567890abcdef",
    "MessageStatus": "delivered",
    "AccountSid": "ACmock1234567890abcdef1234567890",
    "From": "+12345678901",
    "To": "+19876543210",
    "ApiVersion": "2010-04-01"
  }'

echo -e "\n"
echo "Testing with error status..."
curl -X POST http://localhost:8080/api/webhooks/sms/status \
  -H "Content-Type: application/json" \
  -d '{
    "MessageSid": "SM1234567890abcdef",
    "MessageStatus": "failed",
    "AccountSid": "ACmock1234567890abcdef1234567890",
    "From": "+12345678901",
    "To": "+19876543210",
    "ApiVersion": "2010-04-01",
    "ErrorCode": "30008",
    "ErrorMessage": "Unknown error"
  }'

echo -e "\n✅ Twilio Status webhook tests completed"