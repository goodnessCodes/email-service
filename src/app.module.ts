import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EmailLog } from './entity/email-notification.entity';
import { CacheModule } from './cache/cache.module'; 
import { HealthController } from './health/health.controller';
import { EmailService } from './email/email.service';
import { HttpModule, HttpService } from '@nestjs/axios';
import { TerminusModule } from '@nestjs/terminus';

@Module({
  imports: [
  
    ConfigModule.forRoot({
      isGlobal: true,
    }),



    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    TerminusModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USER'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [EmailLog],
        synchronize: process.env.NODE_ENV === 'development',
      }),
    }),
    TypeOrmModule.forFeature([EmailLog]),
    ClientsModule.registerAsync([
      {
        name: 'RABBITMQ_CLIENT',
        inject: [ConfigService],
        useFactory: () => ({
          transport: Transport.RMQ,
          options: {
            urls: [process.env.RABBITMQ_URL as string],
            queue: "email.queue",
            queueOptions: {
              durable: true,
            },
          },
        }),
      },
    ]),
    CacheModule,
  ],
  controllers: [ HealthController],
  providers: [
    EmailService,
  ],
})
export class AppModule { }