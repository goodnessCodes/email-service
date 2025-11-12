// export interface QueuePayload {
//     request_id: string
//     user_id: string
//     notification_type: string
//     channel_priority: string,
//     message_data: Record<string, string>
//     retry_count: number
// }

// export interface EmailTemplate {
//   template_key: string;
//   content_type: string;
//   subject_template: string;
//   body_template: string;
//   required_variables: string[];
// }

export interface EmailTemplate {
    subject: string;
    body: string;
    content_type?: string;
}

export interface UserPreferences {
    email: string;
    email_enabled: boolean;
    user_id: string;
    language?: string;
}

export interface QueuePayload {
    request_id: string;
    user_id: string;
    template_code: string;
    variables: Record<string, any>;
    priority?: string;
    notification_type?: string;
}