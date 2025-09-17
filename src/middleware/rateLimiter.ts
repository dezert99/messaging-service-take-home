import { Request, Response, NextFunction } from 'express';
import { RateLimitConfig } from '../config/rateLimits';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  windowStart: number;
}

export class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  
  constructor(private config: RateLimitConfig) {}

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.getKey(req);
      const now = Date.now();
      
      let bucket = this.buckets.get(key);
      
      if (!bucket || now - bucket.windowStart >= this.config.windowMs) {
        // New window or window expired
        bucket = {
          tokens: this.config.maxRequests - 1,
          lastRefill: now,
          windowStart: now
        };
        this.buckets.set(key, bucket);
        
        // Set headers
        this.setRateLimitHeaders(res, bucket);
        
        return next();
      }
      
      if (bucket.tokens > 0) {
        bucket.tokens--;
        
        // Set headers
        this.setRateLimitHeaders(res, bucket);
        
        return next();
      }
      
      // Rate limit exceeded
      const retryAfter = Math.ceil((bucket.windowStart + this.config.windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      this.setRateLimitHeaders(res, bucket);
      
      res.status(429).json({
        error: this.config.message,
        retryAfter
      });
    };
  }
  
  private setRateLimitHeaders(res: Response, bucket: TokenBucket): void {
    res.setHeader('X-RateLimit-Limit', this.config.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', bucket.tokens.toString());
    res.setHeader('X-RateLimit-Reset', new Date(bucket.windowStart + this.config.windowMs).toISOString());
  }
  
  private getKey(req: Request): string {
    // In production, you might want to use IP address or user ID
    return req.ip || req.connection.remoteAddress || 'global';
  }

  // Method to clean up old buckets (optional, for memory management)
  public cleanup(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.windowStart > this.config.windowMs * 2) {
        this.buckets.delete(key);
      }
    }
  }

  // Method to reset all buckets (for testing)
  public reset(): void {
    this.buckets.clear();
  }
}

// Factory function to create rate limiters
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  return new RateLimiter(config);
}