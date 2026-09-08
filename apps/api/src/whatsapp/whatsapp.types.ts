/** Meta Cloud API + internal WhatsApp integration types (Volume 2). */

export type WhatsAppTemplateName =
  | 'INTERVIEW_INVITATION'
  | 'INTERVIEW_CONFIRMATION'
  | 'INTERVIEW_RESCHEDULE'
  | 'INTERVIEW_REMINDER_24H'
  | 'INTERVIEW_REMINDER_2H'
  | 'INTERVIEW_REMINDER_15M'
  | 'INTERVIEW_CANCELLED'
  | 'INTERVIEW_COMPLETED'
  | 'INTERVIEW_FEEDBACK_AVAILABLE'
  | 'TEST_MESSAGE';

export type InterviewWhatsAppAction =
  | 'CONFIRM'
  | 'RESCHEDULE'
  | 'DECLINE'
  | 'SLOT'
  | 'START'
  | 'UNKNOWN';

export type ReminderKind = '24h' | '2h' | '15m';

export type WhatsAppWebhookBody = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<{
          from?: string;
          id?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
          button?: { text?: string; payload?: string };
          interactive?: {
            type?: string;
            button_reply?: { id?: string; title?: string };
            list_reply?: { id?: string; title?: string };
          };
        }>;
        statuses?: Array<{
          id?: string;
          status?: string;
          timestamp?: string;
          recipient_id?: string;
          errors?: Array<{ code?: number; title?: string; message?: string }>;
        }>;
      };
    }>;
  }>;
};

export type WhatsAppEventLogItem = {
  id: string;
  at: string;
  kind:
    | 'MESSAGE_SENT'
    | 'MESSAGE_DELIVERED'
    | 'MESSAGE_READ'
    | 'MESSAGE_FAILED'
    | 'MESSAGE_RECEIVED'
    | 'BUTTON_CLICKED'
    | 'INTERVIEW_STATUS'
    | 'CONNECTION'
    | 'ERROR'
    | 'INFO';
  summary: string;
  detail?: Record<string, unknown>;
};

export type ParsedInteractivePayload = {
  action: InterviewWhatsAppAction;
  interviewId?: string;
  slotIso?: string;
  raw: string;
};
