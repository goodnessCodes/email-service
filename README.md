# Email Service

A distributed email microservice built with NestJS that processes email notifications asynchronously through RabbitMQ. This service is part of a larger microservices-based notification system.

## Architecture

This service follows event-driven architecture principles:

- **Message Queue**: RabbitMQ for asynchronous communication
- **Database**: PostgreSQL for email logging and audit trails
- **Cache**: Redis (Upstash) for performance optimization and duplicate prevention
- **Email Delivery**: SendGrid SMTP for reliable email sending
- **Containerization**: Docker for consistent deployment

## Features

- Asynchronous email processing via RabbitMQ
- Template-based email rendering with variable substitution
- Circuit breaker pattern for fault tolerance
- Idempotent message processing to prevent duplicates
- Exponential backoff retry logic for failed emails
- Comprehensive health monitoring and metrics
- Redis caching for user preferences and templates
- Database logging for audit trails and debugging

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Redis instance (Upstash recommended)
- RabbitMQ instance
- SendGrid account for email delivery

## Installation

1. Clone the repository:

```bash
git clone  https://github.com/goodylove/email-service.git
cd email-service
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables (see Configuration section)

4. Start the service:

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## Configuration

Create a `.env` file with the following variables:

### Required Environment Variables

```
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_DATABASE=email_service

# Redis
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# RabbitMQ
RABBITMQ_URL=your_rabbitmq_url
RABBITMQ_EMAIL_QUEUE=email.queue

# Email Service (SendGrid)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
EMAIL_FROM=your_verified_email@domain.com
```

### Optional Environment Variables

```
# External Services (for full integration)
TEMPLATE_SERVICE_URL=http://template-service:3000
USER_SERVICE_URL=http://user-service:3001
API_GATEWAY_URL=http://api-gateway:3000

# Feature Flags
DISABLE_SMTP=false  # Set to true for testing without actual email sending
```

## API Endpoints

### Health Check

```
GET /health
```

Returns service health status including database, Redis, and SMTP connectivity.



## Message Format

The service consumes messages from RabbitMQ with the following structure:

```json
{
  "request_id": "unique-request-identifier",
  "user_id": "user-identifier",
  "template_code": "email_template_name",
  "variables": {
    "name": "Recipient Name",
    "company": "Company Name"
  },
  "priority": "high|normal|low"
}
```

## Message Processing Flow

1. **Message Consumption**: RabbitMQ consumer listens to `email.queue`
2. **Duplicate Check**: Redis verifies if request was already processed
3. **Circuit Breaker**: Prevents system overload during failures
4. **Template Rendering**: Retrieves and personalizes email template
5. **Email Delivery**: Sends email via configured SMTP provider
6. **Status Update**: Logs result and updates notification status
7. **Error Handling**: Implements retry logic with exponential backoff

## Database Schema

The service uses a single table for audit logging:

### email_logs

- `id`: Primary key (UUID)
- `request_id`: Unique identifier for the email request
- `user_id`: Recipient user identifier
- `recipient`: Email address
- `subject`: Email subject line
- `message_id`: SMTP message identifier
- `status`: Delivery status (pending, delivered, failed)
- `attempts`: Number of delivery attempts
- `error_message`: Failure description if applicable
- `sent_at`: Timestamp of successful delivery
- `created_at`: Record creation timestamp
- `updated_at`: Record last update timestamp

## Deployment

### Docker



 Run with environment variables:

```bash
docker run -p 3000:3000 --env-file .env email-service
```

### Docker Compose

A `docker-compose.yml` file is provided for local development with PostgreSQL.

### Cloud Deployment

This service can be deployed to:

- Railway
- Render
- Fly.io
- AWS ECS
- Google Cloud Run
- DigitalOcean App Platform

## Monitoring

The service provides several monitoring features:

- Health checks at `/health`
- Structured logging with correlation IDs
- Circuit breaker status monitoring
- Performance metrics for email processing
- Error rate tracking and alerting

## Error Handling

- **Circuit Breaker**: Automatically opens after consecutive failures
- **Exponential Backoff**: Retries failed emails with increasing delays
- **Dead Letter Queue**: Moves permanently failed messages to DLQ
- **Graceful Degradation**: Continues operation during external service failures

## Development






## Dependencies

### Core Dependencies

- @nestjs/common: NestJS framework
- @nestjs/microservices: RabbitMQ integration
- @nestjs/typeorm: Database ORM
- typeorm: Database abstraction
- nodemailer: Email sending
- @upstash/redis: Redis client

### Development Dependencies

- @nestjs/cli: NestJS command line tools

## Support

For issues and questions:

1. Check the health endpoint for service status
2. Review application logs for error details
3. Verify environment variable configuration
4. Check RabbitMQ queue status and message flow

## Performance

- Designed to handle 1000+ emails per minute
- Horizontal scaling supported through stateless design
- Connection pooling for database and SMTP
- Redis caching for optimal performance
