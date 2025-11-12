import { Injectable, Logger, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as nodemailer from 'nodemailer';
import { cache_service } from 'src/cache/cache.module';
import { Redis } from '@upstash/redis';
import { EmailLog, NotificationStatus } from 'src/entity/email-notification.entity';
import { EmailTemplate, QueuePayload, UserPreferences } from './email.types';
import { EmailMessageDto } from 'src/dto/email-message.dto';



@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private transporter: nodemailer.Transporter;
    private circuit_breaker_state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    private failureCount = 0;
    private readonly circuitBreakerThreshold = 5;
    private readonly circuitBreakerTimeout = 60000; // 1 minute

    constructor(
        @InjectRepository(EmailLog)
        private readonly emailLogRepository: Repository<EmailLog>,
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
        @Inject(cache_service) private  readonly cache_service_redis: Redis
    ) {
       
        this.initializeTransporter();
        this.logger.log(' EmailService constructor called');
        this.testRedisInjection();
    }

    private async testRedisInjection() {
        try {
            await this.cache_service_redis.set('email-service-test', 'working', { ex: 60 });
            this.logger.log(' EmailService Redis injection successful');
        } catch (error) {
            this.logger.error(' EmailService Redis injection failed:', error.message);
        }
    }

    private initializeTransporter() {
        this.transporter = nodemailer.createTransport({
            host: this.configService.get('SMTP_HOST'),
            port: this.configService.get('SMTP_PORT'),
            secure: this.configService.get('SMTP_SECURE', false),
            auth: {
                user: this.configService.get('SMTP_USER'),
                pass: this.configService.get('SMTP_PASS'),
            },
            
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            rateDelta: 1000,
            rateLimit: 10
        });

        // Enhanced error handling for SendGrid
        this.transporter.on('error', (error) => {
            this.logger.error('SMTP Transporter Error:', error);
            this.handleCircuitBreaker(error);
        });
    }

   
    async process_email_message(message:EmailMessageDto): Promise<void> {
        const { 
            notification_id,
            user_id,
            recipient_email,
            template_key,
            required_variables,
            priority } = message;

        this.logger.log(`Processing email request: ${notification_id } for user: ${user_id}`);

        // Step 1: Check idempotency - prevent duplicate processing
        const isDuplicate = await this.checkDuplicateRequest(notification_id as string);
        if (isDuplicate) {
            this.logger.warn(`Duplicate request detected: ${notification_id}`);
            return;
        }

        try {
            // Step 2: Check circuit breaker - prevent system overload
            if (this.circuit_breaker_state === 'OPEN') {
                throw new HttpException('Circuit breaker open', HttpStatus.SERVICE_UNAVAILABLE);
            }

          
            // Step 4: Get template from Template Service
            const template = await this.getTemplate(template_key);

            // Step 5: Render email content with variables
            const emailContent = this.renderTemplate(template, required_variables);

            // Step 6: Send the actual email
            await this.sendEmail({
                to: recipient_email,
                subject: emailContent.subject,
                html: emailContent.body,
                request_id:notification_id as string,
                user_id,
            });

            // Step 7: Update status to delivered
            await this.updateNotificationStatus(notification_id as string, NotificationStatus.DELIVERED);

            this.logger.log(`Successfully processed email for request: ${notification_id }`);

        } catch (error) {
            this.logger.error(`Failed to process email for request ${notification_id }: ${error.message}`);

            // Handle circuit breaker - track failures
            await this.handleCircuitBreaker(error);

            // Update status to failed
            await this.updateNotificationStatus(notification_id as string, NotificationStatus.FAILED, error.message);

            // Re-throw to let RabbitMQ consumer handle retry logic
            throw error;
        }
    }

   
    private async sendEmail(emailData: {
        to: string;
        subject: string;
        html: string;
        request_id: string;
        user_id: string;
    }): Promise<void> {
        const { to, subject, html, request_id, user_id } = emailData;

        const mailOptions = {
            from: this.configService.get('EMAIL_FROM'),
            to,
            subject,
            html,
            headers: {
                'X-Request-ID': request_id,
                'X-User-ID': user_id
            }
        };

        // Create email log entry
        const emailLog = this.emailLogRepository.create({
            request_id,
            user_id,
            recipient: to,
            subject,
            status: NotificationStatus.PENDING,
            attempts: 1,
            created_at: new Date(),
        });

        try {
            this.logger.log(`Attempting to send email to: ${to}, Request: ${request_id}`);

            // Actually send the email via SMTP
            const info = await this.transporter.sendMail(mailOptions);
            // const response = await sgMail.send(mailOptions);

            // Update log with success
            emailLog.status = NotificationStatus.DELIVERED;
            emailLog.message_id = info.messageId;
            emailLog.sent_at = new Date();



            // emailLog.status = NotificationStatus.DELIVERED;
            // emailLog.message_id = response[0]?.headers['x-message-id'] || null;
            // emailLog.sent_at = new Date();

            this.logger.log(`Email sent successfully: ${request_id}`);
            this.resetCircuitBreaker(); // Reset circuit breaker on success

        } catch (error) {
            // Update log with failure
            emailLog.status = NotificationStatus.FAILED;
            emailLog.error_message = error.message;
            emailLog.attempts += 1;

            this.logger.error(`Email send failed for ${request_id}: ${error.message}`);
            throw error; // Re-throw to trigger retry logic

        } finally {
            // Always save the log entry
            await this.emailLogRepository.save(emailLog);
        }
    }

    
    private async handleCircuitBreaker(error: Error): Promise<void> {
        this.failureCount++;

        if (this.failureCount >= this.circuitBreakerThreshold && this.circuit_breaker_state === 'CLOSED') {
            this.circuit_breaker_state = 'OPEN';
            this.logger.warn('Circuit breaker opened - email service unavailable');

            // Schedule circuit breaker reset
            setTimeout(() => {
                this.circuit_breaker_state = 'HALF_OPEN';
                this.failureCount = 0;
                this.logger.log('Circuit breaker moved to half-open state');
            }, this.circuitBreakerTimeout);
        }
    }

    private resetCircuitBreaker(): void {
        this.failureCount = 0;
        this.circuit_breaker_state = 'CLOSED';
        this.logger.log('Circuit breaker reset to closed state');
    }

   
    private async checkDuplicateRequest(requestId: string): Promise<boolean> {
        const key = `email:request:${requestId}`;

        try {
            // Check if we already processed this request
            const exists = await this.cache_service_redis.get(key);
            if (exists) {
                return true;
            }

            // Mark as processed with 24-hour expiration
            await this.cache_service_redis.set(key, 'processed', { ex: 86400 });
            return false;
        } catch (error) {
            this.logger.error(`Redis error in duplicate check: ${error.message}`);
            return false; // Continue processing if Redis fails
        }
    }

 

    
    private async getTemplate(templateCode: string): Promise<EmailTemplate> {
        const cacheKey = `email:template:${templateCode}`;

        try {
            // Try cache first
            const cached = await this.cache_service_redis.get(cacheKey);
            if (cached) {
                return JSON.parse(cached as string);
            }

            // Fallback to Template Service API call
            const template = await this.fetchTemplateFromTemplateService(templateCode);

            // Cache for 30 minutes
            await this.cache_service_redis.set(cacheKey, JSON.stringify(template), { ex: 1800 });

            return template;
        } catch (error) {
            this.logger.error(`Failed to get template ${templateCode}: ${error.message}`);
            // Return default template if everything fails
            return this.getDefaultTemplate(templateCode);
        }
    }

    private async fetchTemplateFromTemplateService(templateCode: string): Promise<EmailTemplate> {
        try {
           
            const response = await firstValueFrom(
                this.httpService.get(`http://template-service/templates/${templateCode}`)
            );

            return response.data;
        } catch (error) {
            this.logger.warn(`Failed to fetch template from Template Service, using default: ${error.message}`);
            return this.getDefaultTemplate(templateCode);
        }
    }

    private getDefaultTemplate(templateCode: string): EmailTemplate {
        // Provide default templates for common use cases
        const defaultTemplates: Record<string, EmailTemplate> = {
            'welcome_email': {
                subject: 'Welcome to Our Platform, {{name}}!',
                body: `
                    <h1>Welcome {{name}}!</h1>
                    <p>Thank you for joining our platform. We're excited to have you!</p>
                    <p>Get started by exploring our features.</p>
                `
            },
            'password_reset': {
                subject: 'Reset Your Password',
                body: `
                    <h1>Password Reset Request</h1>
                    <p>Click the link below to reset your password:</p>
                    <a href="{{reset_link}}">Reset Password</a>
                    <p>This link will expire in 1 hour.</p>
                `
            },
            'notification': {
                subject: 'New Notification: {{title}}',
                body: `
                    <h1>{{title}}</h1>
                    <p>{{message}}</p>
                `
            }
        };

        return defaultTemplates[templateCode] || {
            subject: 'Notification from Our Platform',
            body: 'Hello {{name}}, you have a new notification.'
        };
    }

   
    private renderTemplate(template: EmailTemplate, variables: Record<string, any>): { subject: string; body: string } {
        let subject = template.subject;
        let body = template.body;

        // Replace all variable placeholders with actual values
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = new RegExp(`{{${key}}}`, 'g');
            subject = subject.replace(placeholder, String(value));
            body = body.replace(placeholder, String(value));
        }

        // Clean up any unreplaced variables
        subject = subject.replace(/{{\w+}}/g, '');
        body = body.replace(/{{\w+}}/g, '');

        return { subject, body };
    }

    
    private async updateNotificationStatus(
        requestId: string,
        status: NotificationStatus,
        error?: string,
    ): Promise<void> {
        try {
            // This would make an HTTP call to your API Gateway
            const statusUpdate = {
                request_id: requestId,
                status: status,
                timestamp: new Date().toISOString(),
                error: error || null,
                service: 'email'
            };

            // Example implementation (commented out for now):
            /*
            await firstValueFrom(
                this.httpService.patch(
                    `${this.configService.get('API_GATEWAY_URL')}/notifications/status`,
                    statusUpdate
                )
            );
            */

            this.logger.log(`Status update for ${requestId}: ${status} ${error ? '- Error: ' + error : ''}`);

        } catch (updateError) {
            this.logger.error(`Failed to update status for ${requestId}: ${updateError.message}`);
            // Don't throw here - we don't want status update failures to break email processing
        }
    }

    
    async healthCheck(): Promise<{ status: string; circuit_breaker: string; failures: number }> {
        return {
            status: 'healthy',
            circuit_breaker: this.circuit_breaker_state,
            failures: this.failureCount
        };
    }

    
    async setCircuitBreakerState(state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'): Promise<void> {
        this.circuit_breaker_state = state;
        this.failureCount = 0;
        this.logger.log(`Circuit breaker manually set to: ${state}`);
    }
}