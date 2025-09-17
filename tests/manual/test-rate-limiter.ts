/**
 * Manual test for rate limiter functionality
 * Run with: npx ts-node tests/manual/test-rate-limiter.ts
 */
import express from 'express';
import { RateLimiter } from '../../src/middleware/rateLimiter';

const app = express();

// Create rate limiter for SMS with very low limit for testing
const smsRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 3, // Very low for testing
  message: 'SMS rate limit exceeded'
});

// Create rate limiter for Email with slightly higher limit
const emailRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute  
  maxRequests: 5, // Slightly higher for testing
  message: 'Email rate limit exceeded'
});

app.use('/test-sms', smsRateLimiter.middleware());
app.use('/test-email', emailRateLimiter.middleware());

app.get('/test-sms', (req, res) => {
  res.json({ message: 'SMS endpoint called successfully', timestamp: new Date().toISOString() });
});

app.get('/test-email', (req, res) => {
  res.json({ message: 'Email endpoint called successfully', timestamp: new Date().toISOString() });
});

// Start server for testing
const PORT = 3010;
const server = app.listen(PORT, () => {
  console.log(`Rate limiter test server running on port ${PORT}`);
  console.log('\nTo test manually:');
  console.log(`curl -v http://localhost:${PORT}/test-sms`);
  console.log(`curl -v http://localhost:${PORT}/test-email`);
  console.log('\nPress Ctrl+C to stop the server');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down test server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export {};