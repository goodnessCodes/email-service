import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    Index,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

export enum NotificationStatus {
    PENDING = 'pending',
    DELIVERED = 'delivered',
    FAILED = 'failed',
}


@Entity('email_logs')
export class EmailLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    @Index()
    request_id: string;  // Unique ID for this email request

    @Column({ type: 'uuid' })
    @Index()
    user_id: string;     // Which user this email is for

    @Column()
    recipient: string;   // Email address (john@example.com)

    @Column()
    subject: string;     // Email subject

    @Column({ type: 'text', nullable: true })
    message_id: string;  // SMTP server's message ID

    @Column({
        type: 'enum',
        enum: NotificationStatus,
        default: NotificationStatus.PENDING
    })
    status: NotificationStatus;  // pending, delivered, failed

    @Column({ type: 'int', default: 0 })
    attempts: number;    // How many times we tried

    @Column({ type: 'text', nullable: true })
    error_message: string; // What went wrong (if failed)

    @Column({ type: 'timestamp', nullable: true })
    sent_at: Date;      // When email was successfully sent

    @CreateDateColumn()
    created_at: Date;   // When record was created

    @UpdateDateColumn()
    updated_at: Date;   // When record was last updated
}