# Rate Limiting Documentation

## Overview

The Messaging Service implements rate limiting to prevent abuse and ensure fair usage across all clients. Rate limiting is applied per client/IP address using a token bucket algorithm with separate limits for SMS/MMS and Email endpoints.

## Rate Limiting Configuration

### Default Limits

| Endpoint | Default Limit | Window |
|----------|---------------|---------|
| SMS/MMS | 100 requests | 1 minute |
| Email | 500 requests | 1 minute |

### Environment Variables

Configure rate limits using environment variables:

```bash
# SMS/MMS rate limit (requests per minute)
SMS_RATE_LIMIT=100

# Email rate limit (requests per minute)  
EMAIL_RATE_LIMIT=500
```

## Implementation Details

### Token Bucket Algorithm

The service uses a token bucket algorithm that:
- Grants a fixed number of tokens at the start of each window
- Consumes one token per request
- Rejects requests when no tokens remain
- Resets tokens at the start of each new window

### Client Identification

Rate limits are enforced per client based on:
1. IP Address (`req.ip`)
2. Connection remote address (`req.connection.remoteAddress`)
3. Fallback to "global" if neither is available

### Window Behavior

- **Fixed Windows**: Rate limit windows are 60 seconds (1 minute)
- **Window Reset**: Token count resets to maximum at the start of each new window
- **No Token Rollover**: Unused tokens from previous windows are not carried over

## Rate Limit Headers

All API responses include rate limiting headers:

### Success Responses (2xx)

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2024-01-15T10:31:00.000Z
```

### Rate Limited Responses (429)

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2024-01-15T10:31:00.000Z
Retry-After: 30
```

### Header Descriptions

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in the current window |
| `X-RateLimit-Remaining` | Number of requests remaining in current window |
| `X-RateLimit-Reset` | ISO 8601 timestamp when the current window expires |
| `Retry-After` | Seconds to wait before retrying (429 responses only) |

## Rate Limit Responses

### Rate Limit Exceeded (429)

When rate limit is exceeded, the API returns:

```json
{
  "error": "SMS rate limit exceeded. Please retry after some time.",
  "retryAfter": 30
}
```

**Response Fields:**
- `error`: Human-readable error message
- `retryAfter`: Seconds until next window opens

## Endpoint-Specific Behavior

### SMS/MMS Endpoints

**Endpoints affected:**
- `POST /api/messages/sms`

**Rate limit:** 100 requests per minute (configurable)

**Error message:** "SMS rate limit exceeded. Please retry after some time."

### Email Endpoints

**Endpoints affected:**
- `POST /api/messages/email`

**Rate limit:** 500 requests per minute (configurable)

**Error message:** "Email rate limit exceeded. Please retry after some time."

### Unaffected Endpoints

The following endpoints are **not** rate limited:
- `GET /api/conversations`
- `GET /api/conversations/:id/messages`
- `POST /api/webhooks/*`
- `GET /health`

## Testing Rate Limits

### Manual Testing

Test rate limiting by sending multiple requests rapidly:

```bash
# Test SMS rate limiting
for i in {1..105}; do
  curl -X POST http://localhost:8080/api/messages/sms \\
    -H "Content-Type: application/json" \\
    -d '{
      "from": "+12345678901",
      "to": "+19876543210", 
      "type": "sms",
      "body": "Test message #'$i'",
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }' && echo " - Request $i"
done
```

### Automated Testing

Run the rate limiting test suite:

```bash
# Run rate limiting tests
npm test tests/api/rateLimiting.test.ts

# Run specific rate limit test
npm test -- --testNamePattern="should enforce SMS rate limit"
```

### Custom Rate Limit Testing Script

Use the provided testing script:

```bash
# Test rate limits with custom parameters
node scripts/test-rate-limit.js --endpoint sms --count 110 --delay 100
```

## Production Considerations

### Scaling Rate Limits

For high-traffic production environments, consider:

**Increasing Limits:**
```bash
# Higher limits for production
SMS_RATE_LIMIT=1000
EMAIL_RATE_LIMIT=5000
```

**Per-User Rate Limiting:**
Modify the client identification logic to use:
- User authentication tokens
- API keys
- Account IDs

### Distributed Rate Limiting

For multi-server deployments, consider:
- Redis-based rate limiting for shared state
- Database-backed rate limiting
- External rate limiting services (e.g., Kong, nginx)

### Monitoring

Monitor rate limiting metrics:
- Rate limit hit rates per endpoint
- Top clients hitting rate limits
- Rate limit bypass attempts
- Average requests per client

## Rate Limiting Bypass

### Development/Testing

Temporarily disable rate limiting for testing:

```bash
# Set very high limits
SMS_RATE_LIMIT=999999
EMAIL_RATE_LIMIT=999999
```

### Whitelisting

To implement IP whitelisting (requires code modification):

```typescript
// In rateLimiter.ts
private getKey(req: Request): string {
  const ip = req.ip || req.connection.remoteAddress;
  
  // Whitelist specific IPs
  const whitelistedIPs = ['127.0.0.1', '::1', '10.0.0.0/8'];
  if (whitelistedIPs.some(range => ipInRange(ip, range))) {
    return 'whitelisted';
  }
  
  return ip || 'global';
}
```

## Error Handling

### Rate Limit Errors

Rate limit errors do not affect:
- Other endpoints
- Other clients
- Webhook processing
- Internal operations

### Graceful Degradation

When rate limited:
- Client receives clear error message
- Retry timing is provided
- No data is lost
- Other operations continue normally

## Best Practices

### Client Implementation

**Respect Rate Limits:**
```javascript
async function sendMessage(payload) {
  const response = await fetch('/api/messages/sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (response.status === 429) {
    const data = await response.json();
    const retryAfter = data.retryAfter * 1000; // Convert to ms
    
    console.log(`Rate limited. Retrying in ${data.retryAfter} seconds`);
    await new Promise(resolve => setTimeout(resolve, retryAfter));
    
    return sendMessage(payload); // Retry
  }
  
  return response;
}
```

**Monitor Headers:**
```javascript
function checkRateLimit(response) {
  const limit = parseInt(response.headers.get('X-RateLimit-Limit'));
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining'));
  const resetTime = new Date(response.headers.get('X-RateLimit-Reset'));
  
  if (remaining < limit * 0.1) { // Less than 10% remaining
    console.warn(`Rate limit warning: ${remaining}/${limit} requests remaining`);
    console.warn(`Window resets at: ${resetTime}`);
  }
}
```

### Server Configuration

**Production Settings:**
```bash
# Conservative production limits
SMS_RATE_LIMIT=500   # 500 SMS per minute
EMAIL_RATE_LIMIT=2000 # 2000 emails per minute

# Enable comprehensive logging
LOG_LEVEL=info
```

**Development Settings:**
```bash
# Relaxed development limits
SMS_RATE_LIMIT=1000
EMAIL_RATE_LIMIT=5000
LOG_LEVEL=debug
```

## Troubleshooting

### Common Issues

**"Rate limit exceeded immediately"**
- Check if previous requests consumed tokens
- Verify rate limit configuration
- Ensure client identification is working

**"Rate limits not working"**
- Confirm middleware is loaded
- Check rate limit configuration
- Verify client IP detection

**"Different clients sharing rate limits"**
- Check client identification logic
- Verify IP address detection
- Consider proxy/load balancer configuration

### Debug Information

Enable debug logging to see rate limiting in action:

```bash
LOG_LEVEL=debug npm start
```

Debug logs include:
- Client identification
- Token consumption
- Window resets
- Rate limit hits

### Health Monitoring

Monitor rate limiting health:

```bash
# Check if rate limiting is working
curl -I http://localhost:8080/api/messages/sms

# Should include rate limit headers
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 2024-01-15T10:31:00.000Z
```