import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { EmailService } from 'src/email/email.service';

@Controller()
export class EmailConsumer {
    private readonly logger = new Logger(EmailConsumer.name);

    constructor(private readonly email_service: EmailService) { }

    @MessagePattern('email.queue')
    async handle_email_message(@Payload() data: any): Promise<void> {
        this.logger.log(`Received email message: ${data.request_id}`);

        try {
            await this.email_service.process_email_message(data);
            this.logger.log(`Successfully processed email: ${data.request_id}`);
        } catch (error) {
            this.logger.error(`Failed to process email message: ${error.message}`);

            // Implement retry logic or send to dead letter queue
            await this.handle_failed_message(data, error);
        }
    }

    private async handle_failed_message(message: any, error: Error): Promise<void> {
        // Implement retry logic with exponential backoff
        const retryCount = message.retry_count || 0;

        if (retryCount < 3) {
            // Retry with delay
            setTimeout(async () => {
                await this.retry_message({ ...message, retry_count: retryCount + 1 });
            }, Math.pow(2, retryCount) * 1000);
        } else {
            // Send to dead letter queue
            await this.send_to_dead_letter_queue(message, error.message);
        }
    }

    private async retry_message(message: any): Promise<void> {
        // Implement retry logic
        this.logger.log(`Retrying message: ${message.request_id}`);
        await this.handle_email_message(message);
    }

    private async send_to_dead_letter_queue(message: any, error: string): Promise<void> {
        // Send to failed.queue
        this.logger.error(`Moving message to DLQ: ${message.request_id} - ${error}`);
    }
}