
import{ IsString, IsEmail, IsObject, IsOptional, IsInt,Min } from 'class-validator';

export class EmailMessageDto {
    @IsString()
    notification_id?: string;

    @IsString()
    user_id: string;
     

    @IsString()
    subject_template: string;

    @IsString()
    body_template: string;

    @IsString()
    content_type: string;


    @IsEmail()
    recipient_email: string;

    @IsString()
    template_key: string;

    @IsObject()
    required_variables: string[];

    @IsOptional()
    @IsInt()
    @Min(1)
    priority?: number;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, string>;
}