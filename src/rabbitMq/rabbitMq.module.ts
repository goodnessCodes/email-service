import { Module } from '@nestjs/common';
import { ConfigModule} from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EmailService } from 'src/email/email.service';
import { EmailConsumer } from './rabbitMq.consumer';

@Module({
  imports: [
    ConfigModule,

    ClientsModule.registerAsync([
      {
        name: 'RABBITMQ_CLIENT',
        useFactory: () => ({
          transport: Transport.RMQ,
          options: {
            urls: [process.env.RABBITMQ_URL as string],

            queue: 'email.queue',

            queueOptions: {
              durable: true,
            },
          },
        }),
      },
    ]),
  ],
  providers: [EmailService],
  controllers: [EmailConsumer],
  exports: [EmailService],
})
export class RabbitMQModule {}
