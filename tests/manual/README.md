# Manual Tests

This directory contains manual tests for various components that are easier to test interactively.

## Rate Limiter Test

Test the rate limiting middleware functionality:

```bash
npx ts-node tests/manual/test-rate-limiter.ts
```

This starts a test server on port 3010 with two endpoints:
- `/test-sms` - Limited to 3 requests per minute
- `/test-email` - Limited to 5 requests per minute

### Testing Rate Limits

Test SMS rate limiting (should get 429 after 3 requests):
```bash
for i in {1..6}; do 
  echo "Request $i:"
  curl -s -w "Status: %{http_code}\n" http://localhost:3010/test-sms
  echo ""
done
```

Test rate limit headers:
```bash
curl -I http://localhost:3010/test-email
```

Expected headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: ISO timestamp when window resets
- `Retry-After`: Seconds to wait (on 429 responses)

### Expected Behavior

1. First 3 SMS requests should return 200 with success message
2. Subsequent SMS requests should return 429 with error message
3. All responses should include proper rate limit headers
4. Email endpoint should have higher limit (5 requests)