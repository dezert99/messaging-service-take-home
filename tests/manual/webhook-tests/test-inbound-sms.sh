#!/bin/bash

echo "📱 Testing Inbound SMS Webhook..."
curl -X POST http://localhost:8080/api/webhooks/sms \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+12345678901",
    "to": "+19876543210",
    "type": "sms",
    "messaging_provider_id": "SM1234567890abcdef",
    "body": "Hello! This is an inbound SMS message.",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
  }'

echo -e "\n✅ Inbound SMS webhook test completed"