# Messaging Service - Unified Communication API

A production-ready HTTP messaging service that provides a unified API for sending and receiving messages through SMS/MMS and Email providers. Features automatic conversation management, webhook handling, rate limiting, and comprehensive testing.

## Guidelines

At Hatch, we work with several message providers to offer a unified way for our Customers to  communicate to their Contacts. Today we offer SMS, MMS, email, voice calls, and voicemail drops. Your task is to implement an HTTP service that supports the core messaging functionality of Hatch, on a much smaller scale. Specific instructions and guidelines on completing the project are below.

### General Guidelines

- You may use whatever programming language, libraries, or frameworks you'd like. 
- We strongly encourage you to use whatever you're most familiar with so that you can showcase your skills and know-how. Candidates will not receive any kind of 'bonus points' or 'red flags' regarding their specific choices of language.
- You are welcome to use AI, Google, StackOverflow, etc as resources while you're developing. We just ask that you understand the code very well, because we will continue developing on it during your onsite interview.
- For ease of assessment, we strongly encourage you to use the `start.sh` script provided in the `bin/` directory, and implement it to run your service. We will run this script to start your project during our assessment. 

### Project-specific guidelines

- Assume that a provider may return HTTP error codes like 500, 429 and plan accordingly
- Conversations consist of messages from multiple providers. Feel free to consult providers such as Twilio or Sendgrid docs when designing your solution, but all external resources should be mocked out by your project. We do not expect you to actually integrate with a third party provider as part of this project.
- It's OK to use Google or a coding assistant to produce your code. Just make sure you know it well, because the next step will be to code additional features in this codebase with us during your full interview.

## Requirements

The service should implement:

- **Unified Messaging API**: HTTP endpoints to send and receive messages from both SMS/MMS and Email providers
  - Support sending messages through the appropriate provider based on message type
  - Handle incoming webhook messages from both providers
- **Conversation Management**: Messages should be automatically grouped into conversations based on participants (from/to addresses)
- **Data Persistence**: All conversations and messages must be stored in a relational database with proper relationships and indexing

### Providers

**SMS & MMS**

**Example outbound payload to send an SMS or MMS**

```json
{
    "from": "from-phone-number",
    "to": "to-phone-number",
    "type": "mms" | "sms",
    "body": "text message",
    "attachments": ["attachment-url"] | [] | null,
    "timestamp": "2024-11-01T14:00:00Z" // UTC timestamp
}
```

**Example inbound SMS**

```json
{
    "from": "+18045551234",
    "to": "+12016661234",
    "type": "sms",
    "messaging_provider_id": "message-1",
    "body": "text message",
    "attachments": null,
    "timestamp": "2024-11-01T14:00:00Z" // UTC timestamp
}
```

**Example inbound MMS**

```json
{
    "from": "+18045551234",
    "to": "+12016661234",
    "type": "mms",
    "messaging_provider_id": "message-2",
    "body": "text message",
    "attachments": ["attachment-url"] | [],
    "timestamp": "2024-11-01T14:00:00Z" // UTC timestamp
}
```

**Email Provider**

**Example Inbound Email**

```json
{
    "from": "[user@usehatchapp.com](mailto:user@usehatchapp.com)",
    "to": "[contact@gmail.com](mailto:contact@gmail.com)",
    "xillio_id": "message-2",
    "body": "<html><body>html is <b>allowed</b> here </body></html>",  "attachments": ["attachment-url"] | [],
    "timestamp": "2024-11-01T14:00:00Z" // UTC timestamp
}
```

**Example Email Payload**

```json
{
    "from": "[user@usehatchapp.com](mailto:user@usehatchapp.com)",
    "to": "[contact@gmail.com](mailto:contact@gmail.com)",
    "body": "text message with or without html",
    "attachments": ["attachment-url"] | [],
    "timestamp": "2024-11-01T14:00:00Z" // UTC timestamp
}
```

### Project Structure

This project structure is laid out for you already. You are welcome to move or change things, just update the Makefile, scripts, and/or docker resources accordingly. As part of the evaluation of your code, we will run 

```
.
├── bin/                    # Scripts and executables
│   ├── start.sh           # Application startup script
│   └── test.sh            # API testing script with curl commands
├── docker-compose.yml      # PostgreSQL database setup
├── Makefile               # Build and development commands with docker-compose integration
└── README.md              # This file
```

## Features

✅ **Unified Messaging API** - Send SMS, MMS, and Email through a single interface  
✅ **Automatic Conversation Management** - Messages grouped by participants  
✅ **Webhook Support** - Receive inbound messages and status updates  
✅ **Rate Limiting** - Configurable limits with proper headers  
✅ **Mock Provider Integration** - Twilio and SendGrid-like mock implementations  
✅ **Comprehensive Testing** - 74 tests covering all functionality  
✅ **PostgreSQL Database** - Robust data persistence with Prisma ORM  
✅ **TypeScript** - Full type safety and modern development experience  
✅ **Production Ready** - Error handling, logging, validation, and monitoring  

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- PostgreSQL (via Docker)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd messaging-service-take-home
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env if needed - defaults work for development
   ```

4. **Start the database**
   ```bash
   make setup
   # Or manually: docker-compose up -d
   ```

5. **Run database migrations**
   ```bash
   npm run migrate
   ```

6. **Start the application**
   ```bash
   make run
   # Or manually: npm run build && npm start
   ```

7. **Verify it's working**
   ```bash
   curl http://localhost:8080/health
   # Should return: {"status":"ok","timestamp":"..."}
   ```

### Running Tests

```bash
# Run all tests (recommended)
npm test

# Run specific test suites
npm test tests/api/messages.test.ts
npm test tests/api/webhooks.test.ts
npm test tests/api/conversations.test.ts
npm test tests/api/rateLimiting.test.ts

# Run tests with coverage
npm run test:coverage
```

## API Usage

### Send Messages

**Send SMS:**
```bash
curl -X POST http://localhost:8080/api/messages/sms \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+12345678901",
    "to": "+19876543210",
    "type": "sms",
    "body": "Hello from the messaging service!",
    "timestamp": "2024-01-15T10:30:00Z"
  }'
```

**Send Email:**
```bash
curl -X POST http://localhost:8080/api/messages/email \
  -H "Content-Type: application/json" \
  -d '{
    "from": "sender@example.com",
    "to": "recipient@example.com",
    "body": "<p>Hello from the messaging service!</p>",
    "timestamp": "2024-01-15T10:30:00Z"
  }'
```

### Get Conversations

```bash
# List conversations for a participant
curl "http://localhost:8080/api/conversations?participant=%2B12345678901"

# Get messages in a conversation
curl "http://localhost:8080/api/conversations/{conversation-id}/messages"
```

### Test Webhooks

```bash
# Simulate inbound SMS
curl -X POST http://localhost:8080/api/webhooks/sms \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+19876543210",
    "to": "+12345678901",
    "type": "sms",
    "messaging_provider_id": "SM1234567890",
    "body": "Inbound message test",
    "timestamp": "2024-01-15T10:30:00Z"
  }'
```

## Documentation

- **[API Documentation](docs/API.md)** - Complete API reference with examples
- **[Webhook Guide](docs/WEBHOOKS.md)** - Webhook implementation and testing
- **[Rate Limiting](docs/RATE_LIMITING.md)** - Rate limiting configuration and behavior

## Development

### Available Commands

```bash
# Application
make setup      # Set up project and start database
make run        # Start the application  
make test       # Run tests
make clean      # Clean up containers and temp files
make help       # Show all available commands

# Database
make db-up      # Start PostgreSQL database
make db-down    # Stop PostgreSQL database  
make db-logs    # Show database logs
make db-shell   # Connect to database shell

# Development
npm run dev     # Start development server with hot reload
npm run build   # Build TypeScript to JavaScript
npm run lint    # Run ESLint
npm run typecheck # Run TypeScript type checking
```

### Project Structure

```
├── src/
│   ├── controllers/        # Request handlers
│   ├── middleware/         # Express middleware (auth, rate limiting, etc.)
│   ├── routes/            # Route definitions
│   ├── services/          # Business logic
│   ├── providers/         # Mock provider implementations
│   ├── utils/             # Utility functions
│   └── types/             # TypeScript type definitions
├── tests/
│   ├── api/               # API integration tests
│   ├── manual/            # Manual testing scripts
│   └── utils/             # Test utilities and helpers
├── docs/                  # Comprehensive documentation
├── prisma/                # Database schema and migrations
├── bin/                   # Executable scripts
└── postman/               # Postman collection for API testing
```

### Database Schema

The service uses PostgreSQL with Prisma ORM:

- **Conversations**: Grouped messages between participants
- **Messages**: Individual SMS/MMS/Email messages with full metadata
- **ProcessedEvents**: Webhook deduplication tracking

Run migrations:
```bash
npm run migrate         # Apply new migrations
npm run migrate:reset   # Reset database (development only)
npm run generate        # Generate Prisma client
```

### Environment Configuration

Key environment variables (see `.env.example`):

```bash
# Database
DATABASE_URL="postgresql://messaging_user:messaging_password@localhost:5432/messaging_service"

# Server
PORT=8080
NODE_ENV=development

# Rate Limiting  
SMS_RATE_LIMIT=100     # requests per minute
EMAIL_RATE_LIMIT=500   # requests per minute

# Logging
LOG_LEVEL=info

# Webhook Security (optional)
SKIP_WEBHOOK_AUTH=true              # Disable for development
TWILIO_AUTH_TOKEN=your_token_here   # For production webhook verification
SENDGRID_WEBHOOK_VERIFICATION_KEY=your_key_here
```

## Testing

The service includes comprehensive testing with 100% passing tests:

- **74 total tests** across 4 test suites
- **Messages API**: 17/17 tests ✅
- **Webhooks API**: 20/20 tests ✅  
- **Conversations API**: 21/21 tests ✅
- **Rate Limiting**: 16/16 tests ✅

### Manual Testing

Run the comprehensive test script:
```bash
./bin/test.sh
```

Or test individual endpoints:
```bash
# Test specific functionality
./tests/manual/webhook-tests/test-inbound-sms.sh
./tests/manual/webhook-tests/test-twilio-status.sh
./tests/manual/test-rate-limiter.ts
```

## Production Deployment

### Security Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure real webhook secrets (`TWILIO_AUTH_TOKEN`, `SENDGRID_WEBHOOK_VERIFICATION_KEY`)
- [ ] Set `SKIP_WEBHOOK_AUTH=false`
- [ ] Use strong database credentials
- [ ] Configure proper rate limits for your traffic
- [ ] Set up HTTPS/TLS termination
- [ ] Configure log aggregation and monitoring

### Performance Tuning

- **Database**: Ensure proper indexing on high-query columns
- **Rate Limiting**: Adjust limits based on expected traffic
- **Logging**: Use structured logging with appropriate log levels
- **Monitoring**: Set up health checks and metrics collection

## Architecture

### Core Components

1. **API Layer**: Express.js with TypeScript, comprehensive validation
2. **Business Logic**: Service layer with conversation management
3. **Data Layer**: Prisma ORM with PostgreSQL
4. **Provider Layer**: Mock implementations of Twilio and SendGrid
5. **Middleware**: Rate limiting, authentication, error handling, logging

### Key Features

- **Conversation Normalization**: Participants automatically sorted for consistent lookup
- **Message Type Detection**: Automatic SMS/MMS/Email classification  
- **Webhook Deduplication**: Prevents processing duplicate webhook events
- **Status Mapping**: Provider statuses mapped to internal message states
- **Error Handling**: Comprehensive error handling with correlation IDs

### Database

PostgreSQL database with optimized schema:
- Indexed participant lookup for fast conversation queries
- Compound unique constraints for data integrity  
- Proper foreign key relationships
- Event deduplication tracking

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Check what's using port 8080
lsof -i :8080
# Kill the process or change PORT in .env
```

**Database connection failed:**
```bash
# Ensure PostgreSQL is running
make db-up
# Check database logs
make db-logs
```

**Tests failing:**
```bash
# Ensure test database is clean
npm run migrate:reset
# Run tests with verbose output
npm test -- --verbose
```

**Webhook signature verification:**
```bash
# For development, disable verification
SKIP_WEBHOOK_AUTH=true
# For production, ensure secrets are correctly configured
```

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm run dev
```

### Support

- Check the [documentation](docs/) for detailed guides
- Review test files for usage examples
- Use the manual testing scripts for verification
