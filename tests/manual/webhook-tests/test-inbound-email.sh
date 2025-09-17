#!/bin/bash

echo "📧 Testing Inbound Email Webhook..."
curl -X POST http://localhost:8080/api/webhooks/email \
  -H "Content-Type: application/json" \
  -d '{
    "from": "sender@example.com",
    "to": "recipient@company.com",
    "xillio_id": "abc123def456.filter001.'$(date +%s)'.0",
    "body": "<h1>Hello!</h1><p>This is an inbound email message with <strong>HTML content</strong>.</p><p>Here is a <a href=\"https://example.com\">link</a>.</p>",
    "attachments": ["https://example.com/document.pdf", "https://example.com/spreadsheet.xlsx"],
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
  }'

echo -e "\n✅ Inbound Email webhook test completed"