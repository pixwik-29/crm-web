export type UserRole = 'admin' | 'manager' | 'counsellor';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  created_at: string;
}

export interface Lead {
  id: string;
  name: string;
  email?: string;
  phone: string;
  parent_contact?: string;
  neet_marks?: number;
  budget?: number;
  preferred_destination?: string; // State or Country
  course?: string;
  lead_source: string; // Facebook Ads, Instagram Ads, Google Ads, WhatsApp Campaign, etc.
  campaign_name?: string;
  adset_name?: string;
  creative_name?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  landing_page_url?: string;
  status: string; // 1st followup, Discussion stage, Connected to manager, Documents collected, Closed Won, Closed Lost
  assigned_counsellor_id?: string | null;
  tags: string[];
  score: number;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  lead_id: string;
  author_id?: string | null;
  content: string;
  created_at: string;
}

export interface Task {
  id: string;
  lead_id: string;
  assignee_id?: string | null;
  title: string;
  description?: string;
  due_date?: string;
  is_completed: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  lead_id: string;
  actor_id?: string | null;
  action_type: string; // 'status_change', 'note_added', 'task_created', 'task_completed', 'call_logged', 'whatsapp_sent', 'assigned'
  description: string;
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

export interface WhatsAppTemplate {
  id: string;
  name: string;
  body: string;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  color?: string;
  order: number;
}

export interface WebFormField {
  key: string;       // e.g. 'phone', 'email', 'neet_marks'
  label: string;     // Display label on the form
  type: 'text' | 'tel' | 'email' | 'number' | 'select';
  required: boolean;
  enabled: boolean;
  options?: string[]; // for select fields
}

export interface WebForm {
  id: string;
  name: string;          // e.g. "MBBS Enquiry Form"
  lead_source: string;   // e.g. "Website Form"
  button_text: string;
  success_message: string;
  primary_color: string; // hex color
  fields: WebFormField[];
  created_at: string;
}

export interface CRMSettings {
  company_name: string;
  admission_year_prefix: string;
  lead_assignment_rule: 'round-robin' | 'manual';
  routing_budget_threshold: number;
  meta_verify_token: string;
  meta_access_token: string;
  whatsapp_phone_id: string;
  whatsapp_account_id: string;
  whatsapp_api_token: string;
  whatsapp_auto_response_template: string;
  form_integration_strategy?: 'fixed' | 'dynamic';
  form_integration_fixed_course?: string;
  form_integration_dynamic_field?: string;
  pipeline_stages?: PipelineStage[];
  web_forms?: WebForm[];
}
