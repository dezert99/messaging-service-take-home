export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
}

export const rateLimits = {
  sms: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: parseInt(process.env.SMS_RATE_LIMIT || '100'),
    message: 'SMS rate limit exceeded. Please retry after some time.'
  },
  email: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: parseInt(process.env.EMAIL_RATE_LIMIT || '500'),
    message: 'Email rate limit exceeded. Please retry after some time.'
  }
};