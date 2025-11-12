import{ IsString,  IsOptional,IsEnum} from 'class-validator';
import { NotificationStatus } from 'src/entity/email-notification.entity';



export class StatusUpdateDto {
    @IsString()
    notification_id: string;

    @IsEnum(NotificationStatus)
    status: NotificationStatus;  

    @IsOptional()
    @IsString()
    error?: string;  

    @IsOptional()
    timestamp?: Date;  
}