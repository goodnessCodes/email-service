import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from './email.service';
import { EmailLog } from 'src/entity/email-notification.entity';
import { RabbitMQModule } from 'src/rabbitMq/rabbitMq.module';
import { AppController, HealthController } from 'src/health/health.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([EmailLog]),
        RabbitMQModule,
    ],
    providers: [EmailService],
    controllers: [HealthController,AppController],
    exports: [EmailService],
})
export class EmailModule { }