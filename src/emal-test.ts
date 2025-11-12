// import { Redis } from "@upstash/redis";

// const redis = new Redis({
//     url: 'https://coherent-gibbon-35338.upstash.io',
//     token: 'AYoKAAIncDIxZmI1ZDBlYjgyYzY0ZmViOTUyNTI4MTNkYmU2OTJjM3AyMzUzMzg',
// });

// async function test() {
//     try {
//         await redis.set('test', 'working');
//         const result = await redis.get('test');
//         console.log('✅ Redis connection successful:', result);
//     } catch (error) {
//         console.log('❌ Redis connection failed:', error.message);
//     }
// }

// test();



import { Logger } from '@nestjs/common';
import { EmailConsumer } from 'src/rabbitMq/rabbitMq.consumer';

async function testConsumer() {
    const logger = new Logger('TestConsumer');

    // Create mock EmailService
    const mockEmailService = {
        process_email_message: async (data: any) => {
            logger.log(`📧 [MOCK] EmailService processing: ${data.request_id}`);
            logger.log(`📝 Template: ${data.template_code}, User: ${data.user_id}`);

            // Simulate email processing
            await new Promise(resolve => setTimeout(resolve, 100));

            logger.log(`✅ [MOCK] Email processed successfully: ${data.request_id}`);
            return true;
        }
    };

    // Create consumer instance
    const consumer = new EmailConsumer(mockEmailService as any);

    // Test messages
    const testMessages = [
        {
            request_id: 'direct-test-1',
            user_id: 'test-user-1',
            template_code: 'welcome_email',
            variables: { name: 'Test User 1', company: 'Test Corp' }
        },
        {
            request_id: 'direct-test-2',
            user_id: 'test-user-2',
            template_code: 'password_reset',
            variables: { name: 'Test User 2', reset_link: 'https://example.com/reset' }
        }
    ];

    logger.log('🧪 Starting direct EmailConsumer tests...');

    for (const message of testMessages) {
        logger.log(`\n📤 Testing with: ${message.request_id}`);
        await consumer.handle_email_message(message);
    }

    logger.log('✅ All direct tests completed!');
}

testConsumer().catch(console.error);