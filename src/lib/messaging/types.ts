export interface SendMessageOptions {
  to: string;
  type: 'text' | 'template' | 'image' | 'document' | 'video' | 'location' | 'contact';
  text?: string;
  templateName?: string;
  mediaUrl?: string;
  mediaName?: string;
  latitude?: number;
  longitude?: number;
  contactName?: string;
  contactPhone?: string;
  variables?: string[];
  templateBody?: string;
}

export interface IMessagingProvider {
  sendMessage(options: SendMessageOptions): Promise<{ messageId: string; status: string }>;
  syncTemplates(): Promise<WhatsAppTemplate[]>;
  createTemplate(template: Omit<WhatsAppTemplate, 'id' | 'created_at'>): Promise<WhatsAppTemplate>;
  deleteTemplate(templateName: string): Promise<boolean>;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  body: string;
  attachment_url?: string;
  attachment_name?: string;
  headerImageUrl?: string;
  hasImageHeader?: boolean;
  namedParams?: string[];
  status?: 'APPROVED' | 'REJECTED' | 'PENDING' | 'PAUSED';
  category?: string;
  language?: string;
  created_at: string;
}

export interface WhatsAppMessage {
  id: string;
  lead_id: string;
  direction: 'incoming' | 'outgoing';
  message_text: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  created_at: string;
}
