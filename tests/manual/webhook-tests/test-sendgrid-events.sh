#!/bin/bash

echo "🎯 Testing SendGrid Events Webhook..."
echo "Note: This will only work if you have an email with message_id starting with current timestamp"

TIMESTAMP=$(date +%s)
MESSAGE_ID="abc123def456.filter001.${TIMESTAMP}.0"

curl -X POST http://localhost:8080/api/webhooks/email/events \
  -H "Content-Type: application/json" \
  -d '[
    {
      "email": "recipient@company.com",
      "timestamp": '${TIMESTAMP}',
      "smtp-id": "<'${MESSAGE_ID}'@example.com>",
      "event": "processed",
      "sg_event_id": "event_'${TIMESTAMP}'_1",
      "sg_message_id": "'${MESSAGE_ID}'"
    },
    {
      "email": "recipient@company.com",
      "timestamp": '$((TIMESTAMP + 30))',
      "smtp-id": "<'${MESSAGE_ID}'@example.com>",
      "event": "delivered",
      "sg_event_id": "event_'${TIMESTAMP}'_2",
      "sg_message_id": "'${MESSAGE_ID}'"
    },
    {
      "email": "recipient@company.com",
      "timestamp": '$((TIMESTAMP + 60))',
      "smtp-id": "<'${MESSAGE_ID}'@example.com>",
      "event": "open",
      "sg_event_id": "event_'${TIMESTAMP}'_3",
      "sg_message_id": "'${MESSAGE_ID}'"
    }
  ]'

echo -e "\n"
echo "Testing duplicate event (should be ignored)..."
curl -X POST http://localhost:8080/api/webhooks/email/events \
  -H "Content-Type: application/json" \
  -d '[
    {
      "email": "recipient@company.com",
      "timestamp": '${TIMESTAMP}',
      "smtp-id": "<'${MESSAGE_ID}'@example.com>",
      "event": "processed",
      "sg_event_id": "event_'${TIMESTAMP}'_1",
      "sg_message_id": "'${MESSAGE_ID}'"
    }
  ]'

echo -e "\n✅ SendGrid Events webhook tests completed"