import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';

// Create a unique database for each test run
const DATABASE_URL = `${process.env.DATABASE_URL || 'postgresql://messaging_user:messaging_password@localhost:5432'}/messaging_test_${randomBytes(8).toString('hex')}`;

process.env.DATABASE_URL = DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.SKIP_WEBHOOK_AUTH = 'true';

// Global test database instance
let prisma: PrismaClient;

beforeAll(async () => {
  // Create test database
  try {
    execSync(`createdb ${getDatabaseName()}`, { stdio: 'ignore' });
  } catch (error) {
    // Database might already exist, ignore error
  }

  // Initialize Prisma client
  const { PrismaClient } = await import('@prisma/client');
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL
      }
    }
  });

  // Run migrations
  execSync('npx prisma migrate deploy', { 
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL }
  });
});

afterAll(async () => {
  // Clean up
  if (prisma) {
    await prisma.$disconnect();
  }

  // Drop test database
  try {
    execSync(`dropdb ${getDatabaseName()}`, { stdio: 'ignore' });
  } catch (error) {
    // Ignore cleanup errors
  }
});

beforeEach(async () => {
  // Clean all tables before each test
  if (prisma) {
    await prisma.processedEvent.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
  }
  
  // Reset rate limiters between tests
  try {
    const { smsRateLimiter, emailRateLimiter } = await import('../src/routes/messages');
    smsRateLimiter.reset();
    emailRateLimiter.reset();
  } catch (error) {
    // Rate limiters might not be available in all test contexts
  }
});

function getDatabaseName(): string {
  const url = new URL(DATABASE_URL);
  return url.pathname.slice(1); // Remove leading slash
}

// Export for use in tests
export { prisma };

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeValidPhoneNumber(): R;
      toBeValidEmail(): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid UUID`,
      pass,
    };
  },

  toBeValidPhoneNumber(received: string) {
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    const pass = phoneRegex.test(received);
    
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid phone number`,
      pass,
    };
  },

  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid email`,
      pass,
    };
  },
});