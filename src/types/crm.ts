export type UserRole = 'admin' | 'manager' | 'counsellor';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  email?: string;
  created_at: string;
  tenant_id?: string;
  has_shared_inbox_access?: boolean;
}

export interface Lead {
  id: string;
  name: string;
  email?: string;
  phone: string;
  parent_contact?: string;
  whatsapp_number?: string;
  father_number?: string;
  mother_number?: string;
  neet_marks?: number;
  budget?: number;
  preferred_destination?: string; // State or Country
  course?: string;
  external_consultant?: string;
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
  pipeline_id?: string | null;
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
  attachment_url?: string;
  attachment_name?: string;
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

export interface PartnerRoutingRule {
  enabled: boolean;
  pipeline_id: string;   // which pipeline to place the lead in
  stage_id: string;      // which stage within that pipeline
  filter_countries: string[];  // empty = accept all countries
  filter_courses: string[];    // empty = accept all courses
}

export interface CRMSettings {
  company_name: string;
  admission_year_prefix: string;
  lead_assignment_rule: 'round-robin' | 'manual';
  routing_budget_threshold: number;
  meta_verify_token: string;
  meta_access_token: string;
  fb_connected_at?: string;
  fb_pages?: any;
  whatsapp_phone_id: string;
  whatsapp_account_id: string;
  whatsapp_api_token: string;
  whatsapp_auto_response_template: string;
  whatsapp_welcome_partner_template?: string;
  form_integration_strategy?: 'fixed' | 'dynamic';
  form_integration_fixed_course?: string;
  form_integration_dynamic_field?: string;
  pipeline_stages?: PipelineStage[];
  web_forms?: WebForm[];
  // Partner Lead Auto-Routing Rules
  partner_routing_interested?: PartnerRoutingRule;  // For "interested" students
  partner_routing_confirmed?: PartnerRoutingRule;   // For "confirmed admission" students
}

export interface VisaApplication {
  id: string;
  lead_id: string;
  status: string; // 'Document Collection', 'Apostille/Verification', 'Embassy Submission', 'Visa Issued', 'Flyer/Pre-departure'
  target_country?: string;
  target_college?: string;
  visa_notes?: string;
  travel_departure_date?: string;
  travel_departure_airport?: string;
  travel_currency_exchanged: boolean;
  travel_insurance_done: boolean;
  travel_luggage_guidelines: boolean;
  travel_pickup_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export interface VisaRequiredDoc {
  id: string;
  country: string;
  document_name: string;
  is_required: boolean;
  created_at: string;
}

export interface VisaUploadedDoc {
  id: string;
  visa_application_id: string;
  document_name: string;
  file_url: string;
  file_name: string;
  status: 'pending' | 'verified' | 'rejected';
  is_issuance: boolean;
  uploaded_at: string;
  updated_at: string;
}

export interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
  tenant_id: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineAccess {
  id: string;
  pipeline_id: string;
  profile_id: string;
  tenant_id: string;
  created_at: string;
}

export interface Partner {
  id: string;
  business_name: string;
  primary_contact_name: string;
  email: string;
  phone: string;
  whatsapp_number?: string | null;
  status?: string;
  performance_score?: number;
}

export interface PartnerStudent {
  id: string;
  partner_id: string;
  submitted_by?: string | null;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone: string;
  whatsapp_number?: string | null;
  date_of_birth?: string | null;
  passport_number?: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  destination_country: string;
  target_university: string;
  target_program: string;
  academic_history: any;
  english_proficiency: any;
  crm_lead_id?: string | null;
  application_status: string;
  referral_type?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerUploadedDoc {
  id: string;
  student_id: string;
  document_name: string;
  file_url: string;
  file_name: string;
  verification_status: string; // 'pending' | 'verified' | 'rejected'
  expiry_date?: string | null;
  uploaded_at: string;
  updated_at: string;
  uploaded_by_admin?: boolean;
}

export interface RedirectLink {
  id: string;
  slug: string;
  title: string;
  destination_url: string;
  clicks: number;
  created_at: string;
  updated_at: string;
  tenant_id: string;
}

export interface PartnerUser {
  id: string;
  partner_id: string;
  full_name: string;
  email?: string | null;
  role: string;
  created_at: string;
  updated_at?: string;
}
