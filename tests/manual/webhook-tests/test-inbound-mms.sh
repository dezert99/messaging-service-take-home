#!/bin/bash

echo "📷 Testing Inbound MMS Webhook..."
curl -X POST http://localhost:8080/api/webhooks/sms \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+12345678901",
    "to": "+19876543210",
    "type": "mms",
    "messaging_provider_id": "MM1234567890abcdef",
    "body": "Check out this image!",
    "attachments": ["https://example.com/image.jpg", "https://example.com/video.mp4"],
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
  }'

echo -e "\n✅ Inbound MMS webhook test completed"