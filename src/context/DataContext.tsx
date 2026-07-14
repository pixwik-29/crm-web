"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase as originalSupabase, isSupabaseConfigured as originalIsSupabaseConfigured } from '@/lib/supabase';
import { Profile, Lead, Note, Task, ActivityLog, WhatsAppMessage, WhatsAppTemplate, CRMSettings, PipelineStage, UserRole, VisaApplication, VisaRequiredDoc, VisaUploadedDoc, Pipeline, PipelineAccess, Partner, PartnerStudent, PartnerUploadedDoc, RedirectLink } from '@/types/crm';

interface DataContextType {
  isConfigured: boolean;
  isSubscriptionValid: boolean | null; // null = still checking, true = ok, false = blocked
  currentUser: Profile | null;
  setCurrentUser: (profile: Profile | null) => void;
  newLeadAlert: Lead | null;
  setNewLeadAlert: (lead: Lead | null) => void;
  profiles: Profile[];
  leads: Lead[];
  notes: Note[];
  tasks: Task[];
  activityLogs: ActivityLog[];
  whatsappHistory: WhatsAppMessage[];
  whatsappTemplates: WhatsAppTemplate[];
  settings: CRMSettings;
  
  // Pipeline Operations
  pipelines: Pipeline[];
  pipelineAccess: PipelineAccess[];
  activePipeline: Pipeline | null;
  setActivePipeline: (pipeline: Pipeline | null) => void;
  addPipeline: (name: string, stages: PipelineStage[]) => Promise<Pipeline>;
  updatePipeline: (id: string, name: string, stages: PipelineStage[]) => Promise<Pipeline>;
  deletePipeline: (id: string) => Promise<void>;
  updatePipelineAccess: (pipelineId: string, allowedProfileIds: string[]) => Promise<void>;

  // Post-Closing / Visa & Travel Operations
  visaApplications: VisaApplication[];
  visaRequiredDocs: VisaRequiredDoc[];
  visaUploadedDocs: VisaUploadedDoc[];
  updateVisaApplication: (id: string, updates: Partial<VisaApplication>) => Promise<void>;
  saveVisaRequiredDoc: (country: string, documentName: string, isRequired: boolean) => Promise<void>;
  deleteVisaRequiredDoc: (id: string) => Promise<void>;
  uploadVisaDoc: (visaApplicationId: string, documentName: string, file: File, isIssuance: boolean) => Promise<void>;
  deleteVisaDoc: (id: string) => Promise<void>;
  verifyVisaDoc: (id: string, status: 'verified' | 'rejected') => Promise<void>;
  sendVisaDocToStudent: (uploadedDocId: string) => Promise<void>;

  // Partner Portal & Referrals Integration
  partners: Partner[];
  partnerStudents: PartnerStudent[];
  partnerUploadedDocs: PartnerUploadedDoc[];
  connectLeadToPartnerStudent: (leadId: string, studentId: string) => Promise<void>;
  disconnectLeadFromPartnerStudent: (studentId: string) => Promise<void>;
  verifyPartnerDoc: (docId: string, status: 'verified' | 'rejected') => Promise<void>;
  uploadAdminPartnerDoc: (studentId: string, documentName: string, file: File) => Promise<void>;
  syncPartnerReferrals: () => Promise<{ importedCount: number }>;
  colleges: any[];
  redirectLinks: RedirectLink[];
  addRedirectLink: (slug: string, title: string, destinationUrl: string) => Promise<RedirectLink>;
  updateRedirectLink: (id: string, updates: Partial<RedirectLink>) => Promise<RedirectLink>;
  deleteRedirectLink: (id: string) => Promise<void>;
  
  // Auth/User Operations
  login: (email: string, role: UserRole, name: string, password?: string) => Promise<Profile>;
  logout: () => void;
  switchUser: (profile: Profile) => void;
  updateProfileRole: (profileId: string, role: UserRole) => Promise<void>;
  createUserProfile: (email: string, role: UserRole, name: string, phone?: string, password?: string) => Promise<Profile>;
  deleteUserProfile: (profileId: string) => Promise<void>;
  resetUserProfilePassword: (profileId: string, newPassword: string) => Promise<void>;
  updateSettings: (newSettings: Partial<CRMSettings>) => Promise<void>;


  // Lead Operations
  addLead: (lead: Omit<Lead, 'id' | 'created_at' | 'updated_at'>) => Promise<Lead>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<Lead>;
  deleteLead: (id: string) => Promise<void>;
  deleteLeads: (ids: string[]) => Promise<void>;
  bulkAddLeads: (leads: Omit<Lead, 'id' | 'created_at' | 'updated_at'>[]) => Promise<Lead[]>;
  
  // Notes Operations
  addNote: (leadId: string, content: string) => Promise<Note>;
  
  // Tasks Operations
  addTask: (leadId: string, title: string, dueDate?: string) => Promise<Task>;
  toggleTask: (taskId: string) => Promise<Task>;
  
  // WhatsApp Operations
  sendWhatsAppTemplate: (leadId: string, templateId: string) => Promise<void>;
  sendCustomWhatsApp: (leadId: string, message: string) => Promise<void>;
  addWhatsAppTemplate: (template: Omit<WhatsAppTemplate, 'id' | 'created_at'>) => Promise<WhatsAppTemplate>;
  updateWhatsAppTemplate: (id: string, updates: Partial<Omit<WhatsAppTemplate, 'id' | 'created_at'>>) => Promise<WhatsAppTemplate>;
  deleteWhatsAppTemplate: (id: string) => Promise<void>;
  uploadAttachment: (file: File) => Promise<{ url: string; name: string }>;
  
  // Simulation Helpers
  triggerLeadSimulation: () => void;
  isLoading: boolean;
  tenantId: string;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const DEFAULT_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'welcome',
    name: 'Welcome Message',
    body: 'Hello {{lead_name}}, thank you for reaching out to MBBS Admission Consultancy. We have received your query for studying MBBS in {{preferred_destination}}. A counsellor will get in touch with you shortly.',
    created_at: new Date().toISOString()
  },
  {
    id: 'neet-followup',
    name: 'Follow-up NEET Marks',
    body: 'Dear {{lead_name}}, we noticed you scored {{neet_marks}} in NEET. We have excellent medical college options within your budget of {{budget}} in {{preferred_destination}}. Let us know a good time to connect!',
    created_at: new Date().toISOString()
  },
  {
    id: 'docs-checklist',
    name: 'Document Checklist',
    body: 'Hi {{lead_name}}, please share your 10th and 12th marksheet along with your NEET scorecard so we can begin the eligibility assessment process.',
    created_at: new Date().toISOString()
  },
  {
    id: 'offer-letter',
    name: 'Offer Letter Received',
    body: 'Great news {{lead_name}}! Your provisional admission offer letter has been generated by the university. Let us schedule a call to review the next registration steps.',
    created_at: new Date().toISOString()
  },
  {
    id: 'visa-approved',
    name: 'Visa Approved Congratulations',
    body: 'Congratulations {{lead_name}}! Your student visa has been officially approved. Your travel itinerary and departure instructions are being compiled.',
    created_at: new Date().toISOString()
  }
];

const isValidUuid = (id: any): boolean => {
  if (typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

const MOCK_PROFILES: Profile[] = [
  { id: 'user-admin', full_name: 'Nash Newton (Admin)', role: 'admin', email: 'admin@crm.com', created_at: new Date().toISOString(), phone: '+919876543212' },
  { id: 'user-manager', full_name: 'Rajesh Kumar (Manager)', role: 'manager', email: 'manager@crm.com', created_at: new Date().toISOString(), phone: '+919876543213' },
  { id: 'user-counsellor-1', full_name: 'Amit Verma', role: 'counsellor', email: 'amit@crm.com', created_at: new Date().toISOString(), phone: '+919876543210' },
  { id: 'user-counsellor-2', full_name: 'Priya Sharma', role: 'counsellor', email: 'priya@crm.com', created_at: new Date().toISOString(), phone: '+919876543211' }
];



const MOCK_LEADS: Lead[] = [
  {
    id: 'lead-1',
    name: 'Rohan Malhotra',
    email: 'rohan.malhotra@gmail.com',
    phone: '+919988776655',
    parent_contact: '+919988776600',
    neet_marks: 520,
    budget: 6500000,
    preferred_destination: 'Georgia',
    course: 'MBBS Abroad',
    lead_source: 'Facebook Ads',
    campaign_name: 'MBBS Georgia 2026',
    adset_name: 'NEET Qualified 400-550',
    creative_name: 'Georgia Campus Video AD',
    utm_source: 'fb',
    utm_medium: 'cpc',
    utm_campaign: 'georgia_2026',
    landing_page_url: 'https://mbbsconsultancy.com/georgia-admission',
    status: '1st followup',
    assigned_counsellor_id: 'user-counsellor-1',
    tags: ['High Score', 'Georgia Preferred'],
    score: 85,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'lead-2',
    name: 'Ananya Iyer',
    email: 'ananya.iyer@yahoo.com',
    phone: '+919812345678',
    parent_contact: '+919812345600',
    neet_marks: 410,
    budget: 4500000,
    preferred_destination: 'Russia',
    course: 'MBBS Abroad',
    lead_source: 'Google Ads',
    campaign_name: 'Affordable MBBS Search',
    adset_name: 'Low Cost MBBS',
    creative_name: 'Russia Top Universities Text AD',
    utm_source: 'google',
    utm_medium: 'search',
    utm_campaign: 'russia_affordable',
    landing_page_url: 'https://mbbsconsultancy.com/affordable-mbbs',
    status: 'Discussion stage',
    assigned_counsellor_id: 'user-counsellor-1',
    tags: ['Budget Student'],
    score: 60,
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(), // 5 hours ago
    updated_at: new Date(Date.now() - 3600000 * 4).toISOString()
  },
  {
    id: 'lead-3',
    name: 'Vikram Singh',
    email: 'vikram.singh@outlook.com',
    phone: '+919555123456',
    parent_contact: '+919555123400',
    neet_marks: 610,
    budget: 12000000,
    preferred_destination: 'India (Private/Management)',
    course: 'MBBS',
    lead_source: 'Website Form',
    campaign_name: 'Organic Search Home Page',
    landing_page_url: 'https://mbbsconsultancy.com/',
    status: 'Connected to manager',
    assigned_counsellor_id: 'user-counsellor-2',
    tags: ['High Budget', 'India College Option', 'Premium'],
    score: 95,
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
    updated_at: new Date(Date.now() - 3600000 * 20).toISOString()
  },
  {
    id: 'lead-4',
    name: 'Sneha Patel',
    email: 'sneha.patel@gmail.com',
    phone: '+919321456789',
    parent_contact: '+919321456700',
    neet_marks: 350,
    budget: 5000000,
    preferred_destination: 'Philippines',
    course: 'Nursing',
    lead_source: 'Instagram Ads',
    campaign_name: 'MBBS Philippines Summer',
    adset_name: 'Parents Target',
    creative_name: 'Philippines Career Prospects Image AD',
    utm_source: 'instagram',
    utm_medium: 'feed',
    utm_campaign: 'philippines_summer',
    status: 'Documents collected',
    assigned_counsellor_id: 'user-counsellor-2',
    tags: ['Philippines Choice'],
    score: 55,
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(), // 2 days ago
    updated_at: new Date(Date.now() - 3600000 * 44).toISOString()
  },
  {
    id: 'lead-5',
    name: 'Kabir Thapar',
    email: 'kabir.thapar@gmail.com',
    phone: '+919999888777',
    neet_marks: 480,
    budget: 6000000,
    preferred_destination: 'Nepal',
    course: 'MBA',
    lead_source: 'YouTube',
    campaign_name: 'Vlog Nepal Medical College Reviews',
    status: 'Closed Won',
    assigned_counsellor_id: 'user-counsellor-1',
    tags: ['Admission Done', 'Nepal Option'],
    score: 100,
    created_at: new Date(Date.now() - 3600000 * 120).toISOString(), // 5 days ago
    updated_at: new Date(Date.now() - 3600000 * 96).toISOString()
  }
];

const DEFAULT_PIPELINE_STAGES: PipelineStage[] = [
  { id: '1st followup', name: '1st followup', color: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400', order: 0 },
  { id: 'Discussion stage', name: 'Discussion stage', color: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400', order: 1 },
  { id: 'Connected to manager', name: 'Connected to manager', color: 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400', order: 2 },
  { id: 'Documents collected', name: 'Documents collected', color: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400', order: 3 },
  { id: 'Closed Won', name: 'Closed Won', color: 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400', order: 4 },
  { id: 'Closed Lost', name: 'Closed Lost', color: 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400', order: 5 }
];

const VISA_PIPELINE_STAGES: PipelineStage[] = [
  { id: 'Doc Collection', name: 'Document Collection', color: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400', order: 0 },
  { id: 'Apostille', name: 'Apostille/Verification', color: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400', order: 1 },
  { id: 'Embassy Submission', name: 'Embassy Submission', color: 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400', order: 2 },
  { id: 'Visa Issued', name: 'Visa Issued', color: 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400', order: 3 },
  { id: 'Flyer/Pre-departure', name: 'Flyer/Pre-departure', color: 'bg-teal-500/10 border-teal-500/30 text-teal-600 dark:text-teal-400', order: 4 }
];

const MOCK_VISA_REQ_DOCS: VisaRequiredDoc[] = [
  { id: 'vrd-1', country: 'Georgia', document_name: 'Passport Copy', is_required: true, created_at: new Date().toISOString() },
  { id: 'vrd-2', country: 'Georgia', document_name: '12th Marksheet', is_required: true, created_at: new Date().toISOString() },
  { id: 'vrd-3', country: 'Georgia', document_name: 'NEET Score Card', is_required: true, created_at: new Date().toISOString() },
  { id: 'vrd-4', country: 'Georgia', document_name: 'Police Clearance Certificate', is_required: true, created_at: new Date().toISOString() },
  { id: 'vrd-5', country: 'Russia', document_name: 'Passport Copy', is_required: true, created_at: new Date().toISOString() },
  { id: 'vrd-6', country: 'Russia', document_name: '12th Marksheet', is_required: true, created_at: new Date().toISOString() },
  { id: 'vrd-7', country: 'Russia', document_name: 'NEET Score Card', is_required: true, created_at: new Date().toISOString() },
  { id: 'vrd-8', country: 'Russia', document_name: 'Medical Health Certificate', is_required: true, created_at: new Date().toISOString() }
];

const DEFAULT_SETTINGS: CRMSettings = {
  company_name: 'Perfect Scholar Lead Management',
  admission_year_prefix: '2026',
  lead_assignment_rule: 'round-robin',
  routing_budget_threshold: 40,
  meta_verify_token: 'edupath_crm_verify_token_xyz',
  meta_access_token: '',
  fb_pages: [],
  whatsapp_phone_id: '109827364583920',
  whatsapp_account_id: '120938475647382',
  whatsapp_api_token: 'EAAG...whatsapp...token',
  whatsapp_auto_response_template: 'welcome',
  form_integration_strategy: 'fixed',
  form_integration_fixed_course: 'MBBS',
  form_integration_dynamic_field: 'course',
  pipeline_stages: DEFAULT_PIPELINE_STAGES
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [whatsappHistory, setWhatsappHistory] = useState<WhatsAppMessage[]>([]);
  const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsAppTemplate[]>(DEFAULT_TEMPLATES);
  const [settings, setSettings] = useState<CRMSettings>(DEFAULT_SETTINGS);
  
  // Post-Closing States
  const [visaApplications, setVisaApplications] = useState<VisaApplication[]>([]);
  const [visaRequiredDocs, setVisaRequiredDocs] = useState<VisaRequiredDoc[]>([]);
  const [visaUploadedDocs, setVisaUploadedDocs] = useState<VisaUploadedDoc[]>([]);
  
  // Partner Portal States
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerStudents, setPartnerStudents] = useState<PartnerStudent[]>([]);
  const [partnerUploadedDocs, setPartnerUploadedDocs] = useState<PartnerUploadedDoc[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [redirectLinks, setRedirectLinks] = useState<RedirectLink[]>([]);
  
  // Pipeline States
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineAccess, setPipelineAccess] = useState<PipelineAccess[]>([]);
  const [activePipeline, setActivePipeline] = useState<Pipeline | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string>('');
  // null = still verifying, true = active subscription, false = blocked/deleted
  const [isSubscriptionValid, setIsSubscriptionValid] = useState<boolean | null>(null);
  const [newLeadAlert, setNewLeadAlert] = useState<Lead | null>(null);

  const isSupabaseConfigured = originalIsSupabaseConfigured;
  const supabase = originalSupabase;

  const getStorageKey = (key: string) => {
    if (tenantId !== 'default') {
      return `${key}_tenant_${tenantId}`;
    }
    return key;
  };

  // 1. Resolve tenantId and currentUser on mount
  useEffect(() => {
    const initSession = async () => {
      const client = originalSupabase;
      const isDbActive = originalIsSupabaseConfigured && client;
      
      const params = new URLSearchParams(window.location.search);
      const urlTenant = params.get('tenant') || 'default';

      if (isDbActive && client) {
        try {
          const { data: { session } } = await client.auth.getSession();
          if (session?.user) {
            // Fetch profile for the session user (without tenant filter first!)
            const { data: profile } = await client
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            if (profile) {
              const activeTenant = profile.tenant_id || urlTenant;
              setCurrentUser(profile as Profile);
              setTenantId(activeTenant);
              return;
            }
          }
        } catch (err) {
          console.error("Error checking auth session:", err);
        }
      } else {
        // LocalStorage fallback
        const getLocalKey = (key: string) => {
          return urlTenant !== 'default' ? `${key}_tenant_${urlTenant}` : key;
        };
        const storedUser = localStorage.getItem(getLocalKey('crm_user'));
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setCurrentUser(parsedUser);
          setTenantId(urlTenant);
          return;
        } else if (urlTenant === 'default') {
          setCurrentUser(MOCK_PROFILES[0]); // Auto-login as admin initially for default tenant in mock mode
          setTenantId('default');
          return;
        }
      }
      
      // Fallback if no session/profile
      setTenantId(urlTenant);
    };

    initSession();
  }, []);

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Dual-tone chime: first tone D5, second tone A5
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12); // A5
      
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (err) {
      console.warn('Failed to play notification audio:', err);
    }
  };

  // 2. Load settings and data for the active tenantId
  useEffect(() => {
    if (!tenantId) return;

    let leadsChannel: any = null;
    const client = originalSupabase;
    const isDbActive = originalIsSupabaseConfigured && client;

    const getLocalKey = (key: string) => {
      return tenantId !== 'default' ? `${key}_tenant_${tenantId}` : key;
    };

    const loadData = async () => {
      setIsLoading(true);

      // ── SUBSCRIPTION GUARD ──────────────────────────────────────────────────
      // For sub-tenants (non-default), always verify their subscription is active
      if (tenantId !== 'default') {
        if (isDbActive && client) {
          const { data: subRow, error: subErr } = await client
            .from('crm_subscriptions')
            .select('id, status')
            .eq('id', tenantId)
            .maybeSingle();

          if (subErr) {
            console.warn('Subscription check error:', subErr.message);
          }

          if (!subRow || subRow.status !== 'active') {
            console.warn(`Subscription for tenant ${tenantId} is missing or inactive. Blocking access.`);
            setIsSubscriptionValid(false);
            setIsLoading(false);
            return; // Abort all data loading
          }
        } else {
          // Mock mode: check localStorage partner_subscriptions list
          const stored = localStorage.getItem('partner_subscriptions');
          if (stored) {
            const subs = JSON.parse(stored) as Array<{ id: string; status: string }>;
            const match = subs.find(s => s.id === tenantId);
            if (!match || match.status !== 'active') {
              console.warn(`[Mock] Subscription for tenant ${tenantId} not found or inactive.`);
              setIsSubscriptionValid(false);
              setIsLoading(false);
              return;
            }
          }
        }
      }
      setIsSubscriptionValid(true);
      // ── END SUBSCRIPTION GUARD ──────────────────────────────────────────────

      if (isDbActive && client) {
        try {
          // Load other entities
          const { data: pList } = await client.from('profiles').select('*').eq('tenant_id', tenantId);
          if (pList) setProfiles(pList as Profile[]);

          const { data: lList } = await client.from('leads').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
          if (lList) setLeads(lList as Lead[]);

          const { data: nList } = await client.from('notes').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
          if (nList) setNotes(nList as Note[]);

          const { data: tList } = await client.from('tasks').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
          if (tList) setTasks(tList as Task[]);

          const { data: aList } = await client.from('activity_logs').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
          if (aList) setActivityLogs(aList as ActivityLog[]);

          const { data: wHist } = await client.from('whatsapp_history').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
          if (wHist) setWhatsappHistory(wHist as WhatsAppMessage[]);

          const { data: wTemp } = await client.from('whatsapp_templates').select('*').eq('tenant_id', tenantId);
          if (wTemp && wTemp.length > 0) setWhatsappTemplates(wTemp as WhatsAppTemplate[]);

          const { data: vApps } = await client.from('visa_applications').select('*').eq('tenant_id', tenantId);
          if (vApps) setVisaApplications(vApps as VisaApplication[]);

          const { data: vReqDocs } = await client.from('visa_required_docs').select('*').eq('tenant_id', tenantId);
          if (vReqDocs) setVisaRequiredDocs(vReqDocs as VisaRequiredDoc[]);

          const { data: vUpDocs } = await client.from('visa_uploaded_docs').select('*').eq('tenant_id', tenantId);
          if (vUpDocs) setVisaUploadedDocs(vUpDocs as VisaUploadedDoc[]);

          // Load Partner Portal data
          const { data: partList } = await client.from('partners').select('*');
          if (partList) setPartners(partList as Partner[]);

          const { data: partStudentsList } = await client.from('partner_students').select('*');
          if (partStudentsList) setPartnerStudents(partStudentsList as PartnerStudent[]);
 
          const { data: partUploadedDocsList } = await client.from('partner_uploaded_docs').select('*');
          if (partUploadedDocsList) setPartnerUploadedDocs(partUploadedDocsList as PartnerUploadedDoc[]);
 
          const { data: collegesList } = await client.from('partner_colleges').select('*');
          if (collegesList) setColleges(collegesList);

          const { data: redirLinks } = await client.from('redirect_links').select('*').eq('tenant_id', tenantId);
          if (redirLinks) setRedirectLinks(redirLinks as RedirectLink[]);

          // Load settings first
          const { data: dbSettings } = await client
            .from('settings')
            .select('*')
            .eq('tenant_id', tenantId)
            .maybeSingle();

          const activeSettings = dbSettings || DEFAULT_SETTINGS;
          if (dbSettings) {
            setSettings(dbSettings as CRMSettings);
          } else {
            // Upsert defaults for this new tenant
            const defaultWithTenant = {
              ...DEFAULT_SETTINGS,
              tenant_id: tenantId
            };
            const { error: insertErr } = await client
              .from('settings')
              .upsert(defaultWithTenant);
            if (insertErr) {
              console.error("Failed to insert default settings:", insertErr);
            }
            setSettings(defaultWithTenant);
          }

          // Load pipelines and pipeline access
          // IMPORTANT: Capture error separately — a null result from an RLS/auth error
          // must NOT be treated as "no pipelines exist" (which would re-seed and duplicate).
          const { data: pipeList, error: pipeListErr } = await client.from('pipelines').select('*').eq('tenant_id', tenantId);
          const { data: pipeAccessList } = await client.from('pipeline_access').select('*').eq('tenant_id', tenantId);

          let resolvedPipelines = (pipeList as Pipeline[]) || [];
          let resolvedAccess = (pipeAccessList as PipelineAccess[]) || [];

          // Only seed a default pipeline if:
          // 1. The query succeeded (no error), AND
          // 2. The result is genuinely empty (user has never created a pipeline), AND
          // 3. We haven't seeded before (guard flag prevents re-seeding after intentional deletion)
          const pipelineSeededKey = `crm_pipelines_seeded_${tenantId}`;
          const alreadySeeded = typeof window !== 'undefined' && !!localStorage.getItem(pipelineSeededKey);

          if (!pipeListErr && resolvedPipelines.length === 0 && !alreadySeeded) {
            // Seed default Sales Pipeline on first-ever load only
            const defaultPipeline = {
              name: 'Sales Pipeline',
              stages: activeSettings.pipeline_stages || DEFAULT_PIPELINE_STAGES,
              tenant_id: tenantId,
              is_default: true
            };
            const { data: inserted, error: insertErr } = await client
              .from('pipelines')
              .insert([defaultPipeline])
              .select()
              .single();

            if (insertErr) {
              console.error("Failed to seed default pipeline:", insertErr.message);
            } else if (inserted) {
              resolvedPipelines = [inserted as Pipeline];
              if (typeof window !== 'undefined') {
                localStorage.setItem(pipelineSeededKey, 'true');
              }
              // Grant access to session user
              const { data: { session } } = await client.auth.getSession();
              if (session?.user) {
                const { data: accessInserted } = await client.from('pipeline_access').insert([{
                  pipeline_id: inserted.id,
                  profile_id: session.user.id,
                  tenant_id: tenantId
                }]).select().single();
                if (accessInserted) resolvedAccess = [accessInserted as PipelineAccess];
              }
            }
          } else if (!pipeListErr && resolvedPipelines.length > 0 && !alreadySeeded) {
            // Pipelines exist but flag not set yet — mark it now
            if (typeof window !== 'undefined') {
              localStorage.setItem(pipelineSeededKey, 'true');
            }
          } else if (pipeListErr) {
            console.error("Failed to load pipelines (RLS or network error):", pipeListErr.message);
          }

          setPipelines(resolvedPipelines);
          setPipelineAccess(resolvedAccess);

          const defaultPipe = resolvedPipelines.find(p => p.is_default) || resolvedPipelines[0] || null;
          setActivePipeline(defaultPipe);

          // Set up real-time listener subscriptions
          leadsChannel = client.channel(`realtime-db-${tenantId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `tenant_id=eq.${tenantId}` }, (payload) => {
              if (payload.eventType === 'INSERT') {
                const newLead = payload.new as Lead;
                setLeads(prev => [newLead, ...prev]);
                
                // Play audio chime and trigger context banner
                setNewLeadAlert(newLead);
                playNotificationSound();
                
                // Trigger HTML5 System Notification if tab is in background
                if (typeof window !== 'undefined' && 'Notification' in window) {
                  if (Notification.permission === 'granted') {
                    new Notification('🔥 New Lead Ingested!', {
                      body: `${newLead.name} - NEET: ${newLead.neet_marks || 'N/A'} (${newLead.lead_source})`,
                      icon: '/favicon.png'
                    });
                  }
                }
              } else if (payload.eventType === 'UPDATE') {
                setLeads(prev => prev.map(l => l.id === payload.new.id ? (payload.new as Lead) : l));
              } else if (payload.eventType === 'DELETE') {
                setLeads(prev => prev.filter(l => l.id !== payload.old.id));
              }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `tenant_id=eq.${tenantId}` }, (payload) => {
              if (payload.eventType === 'INSERT') setNotes(prev => [payload.new as Note, ...prev]);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `tenant_id=eq.${tenantId}` }, (payload) => {
              if (payload.eventType === 'INSERT') {
                setTasks(prev => [payload.new as Task, ...prev]);
              } else if (payload.eventType === 'UPDATE') {
                setTasks(prev => prev.map(t => t.id === payload.new.id ? (payload.new as Task) : t));
              }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_history', filter: `tenant_id=eq.${tenantId}` }, (payload) => {
              if (payload.eventType === 'INSERT') setWhatsappHistory(prev => [payload.new as WhatsAppMessage, ...prev]);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_templates', filter: `tenant_id=eq.${tenantId}` }, (payload) => {
              if (payload.eventType === 'INSERT') {
                setWhatsappTemplates(prev => {
                  if (prev.some(t => t.id === payload.new.id)) return prev;
                  return [...prev, payload.new as WhatsAppTemplate];
                });
              } else if (payload.eventType === 'UPDATE') {
                setWhatsappTemplates(prev => prev.map(t => t.id === payload.new.id ? (payload.new as WhatsAppTemplate) : t));
              } else if (payload.eventType === 'DELETE') {
                setWhatsappTemplates(prev => prev.filter(t => t.id !== payload.old.id));
              }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'visa_applications', filter: `tenant_id=eq.${tenantId}` }, (payload) => {
              if (payload.eventType === 'INSERT') {
                setVisaApplications(prev => [payload.new as VisaApplication, ...prev]);
              } else if (payload.eventType === 'UPDATE') {
                setVisaApplications(prev => prev.map(va => va.id === payload.new.id ? (payload.new as VisaApplication) : va));
              } else if (payload.eventType === 'DELETE') {
                setVisaApplications(prev => prev.filter(va => va.id !== payload.old.id));
              }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'visa_required_docs', filter: `tenant_id=eq.${tenantId}` }, (payload) => {
              if (payload.eventType === 'INSERT') {
                setVisaRequiredDocs(prev => [...prev, payload.new as VisaRequiredDoc]);
              } else if (payload.eventType === 'UPDATE') {
                setVisaRequiredDocs(prev => prev.map(vrd => vrd.id === payload.new.id ? (payload.new as VisaRequiredDoc) : vrd));
              } else if (payload.eventType === 'DELETE') {
                setVisaRequiredDocs(prev => prev.filter(vrd => vrd.id !== payload.old.id));
              }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'visa_uploaded_docs', filter: `tenant_id=eq.${tenantId}` }, (payload) => {
              if (payload.eventType === 'INSERT') {
                setVisaUploadedDocs(prev => [payload.new as VisaUploadedDoc, ...prev]);
              } else if (payload.eventType === 'UPDATE') {
                setVisaUploadedDocs(prev => prev.map(vud => vud.id === payload.new.id ? (payload.new as VisaUploadedDoc) : vud));
              } else if (payload.eventType === 'DELETE') {
                setVisaUploadedDocs(prev => prev.filter(vud => vud.id !== payload.old.id));
              }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: `tenant_id=eq.${tenantId}` }, (payload) => {
              if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                setSettings(payload.new as CRMSettings);
              }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pipelines', filter: `tenant_id=eq.${tenantId}` }, (payload) => {
              if (payload.eventType === 'INSERT') {
                setPipelines(prev => [...prev, payload.new as Pipeline]);
              } else if (payload.eventType === 'UPDATE') {
                setPipelines(prev => prev.map(p => p.id === payload.new.id ? (payload.new as Pipeline) : p));
              } else if (payload.eventType === 'DELETE') {
                setPipelines(prev => prev.filter(p => p.id !== payload.old.id));
              }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_access', filter: `tenant_id=eq.${tenantId}` }, (payload) => {
              if (payload.eventType === 'INSERT') {
                setPipelineAccess(prev => [...prev, payload.new as PipelineAccess]);
              } else if (payload.eventType === 'UPDATE') {
                setPipelineAccess(prev => prev.map(pa => pa.id === payload.new.id ? (payload.new as PipelineAccess) : pa));
              } else if (payload.eventType === 'DELETE') {
                setPipelineAccess(prev => prev.filter(pa => pa.id !== payload.old.id));
              }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'partners' }, (payload) => {
              if (payload.eventType === 'INSERT') {
                setPartners(prev => [...prev, payload.new as Partner]);
              } else if (payload.eventType === 'UPDATE') {
                setPartners(prev => prev.map(p => p.id === payload.new.id ? (payload.new as Partner) : p));
              } else if (payload.eventType === 'DELETE') {
                setPartners(prev => prev.filter(p => p.id !== payload.old.id));
              }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_students' }, (payload) => {
              if (payload.eventType === 'INSERT') {
                setPartnerStudents(prev => [...prev, payload.new as PartnerStudent]);
              } else if (payload.eventType === 'UPDATE') {
                setPartnerStudents(prev => prev.map(ps => ps.id === payload.new.id ? (payload.new as PartnerStudent) : ps));
              } else if (payload.eventType === 'DELETE') {
                setPartnerStudents(prev => prev.filter(ps => ps.id !== payload.old.id));
              }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_uploaded_docs' }, (payload) => {
              if (payload.eventType === 'INSERT') {
                setPartnerUploadedDocs(prev => [...prev, payload.new as PartnerUploadedDoc]);
              } else if (payload.eventType === 'UPDATE') {
                setPartnerUploadedDocs(prev => prev.map(pud => pud.id === payload.new.id ? (payload.new as PartnerUploadedDoc) : pud));
              } else if (payload.eventType === 'DELETE') {
                setPartnerUploadedDocs(prev => prev.filter(pud => pud.id !== payload.old.id));
              }
            })
            .subscribe();
        } catch (error) {
          console.error("Supabase data load error: ", error);
        }
      } else {
        // LocalStorage fallback mock load
        const storedProfiles = localStorage.getItem(getLocalKey('crm_profiles'));
        const storedLeads = localStorage.getItem(getLocalKey('crm_leads'));
        const storedNotes = localStorage.getItem(getLocalKey('crm_notes'));
        const storedTasks = localStorage.getItem(getLocalKey('crm_tasks'));
        const storedLogs = localStorage.getItem(getLocalKey('crm_logs'));
        const storedWHist = localStorage.getItem(getLocalKey('crm_whist'));
        const storedSettings = localStorage.getItem(getLocalKey('crm_settings'));
        const storedWTemp = localStorage.getItem(getLocalKey('crm_whatsapp_templates'));

        let parsedProfiles = storedProfiles ? JSON.parse(storedProfiles) : (tenantId !== 'default' ? [
          { id: `user-admin-${tenantId}`, full_name: `Admin`, role: 'admin' as UserRole, created_at: new Date().toISOString() }
        ] : MOCK_PROFILES);
        let parsedLeads = storedLeads ? JSON.parse(storedLeads) : (tenantId !== 'default' ? [] : MOCK_LEADS);
        let parsedNotes = storedNotes ? JSON.parse(storedNotes) : [];
        let parsedTasks = storedTasks ? JSON.parse(storedTasks) : [];
        let parsedLogs = storedLogs ? JSON.parse(storedLogs) : [];
        let parsedWHist = storedWHist ? JSON.parse(storedWHist) : [];
        let parsedSettings = storedSettings ? JSON.parse(storedSettings) : { ...DEFAULT_SETTINGS, tenant_id: tenantId };
        let parsedWTemp = storedWTemp ? JSON.parse(storedWTemp) : DEFAULT_TEMPLATES;

        setProfiles(parsedProfiles);
        setLeads(parsedLeads);
        setNotes(parsedNotes);
        setTasks(parsedTasks);
        setActivityLogs(parsedLogs);
        setWhatsappHistory(parsedWHist);
        setWhatsappTemplates(parsedWTemp);
        setSettings(parsedSettings);

        const storedVApps = localStorage.getItem(getLocalKey('crm_visa_apps'));
        const storedVReqDocs = localStorage.getItem(getLocalKey('crm_visa_req_docs'));
        const storedVUpDocs = localStorage.getItem(getLocalKey('crm_visa_up_docs'));

        let parsedVApps = storedVApps ? JSON.parse(storedVApps) : [];
        let parsedVReqDocs = storedVReqDocs ? JSON.parse(storedVReqDocs) : (tenantId !== 'default' ? [] : MOCK_VISA_REQ_DOCS);
        let parsedVUpDocs = storedVUpDocs ? JSON.parse(storedVUpDocs) : [];

        setVisaApplications(parsedVApps);
        setVisaRequiredDocs(parsedVReqDocs);
        setVisaUploadedDocs(parsedVUpDocs);

        // Load mock partner portal data
        const storedPartners = localStorage.getItem(getLocalKey('crm_partners'));
        const storedPartnerStudents = localStorage.getItem(getLocalKey('crm_partner_students'));
        const storedPartnerUploadedDocs = localStorage.getItem(getLocalKey('crm_partner_uploaded_docs'));

        let parsedPartners = storedPartners ? JSON.parse(storedPartners) : [];
        let parsedPartnerStudents = storedPartnerStudents ? JSON.parse(storedPartnerStudents) : [];
        let parsedPartnerUploadedDocs = storedPartnerUploadedDocs ? JSON.parse(storedPartnerUploadedDocs) : [];

        if (parsedPartners.length === 0 && tenantId === 'default') {
          parsedPartners = [
            { id: 'partner-1', business_name: 'Global Education Services', primary_contact_name: 'Sarah Jenkins', email: 'sarah@globaledu.com', phone: '+919876543220', status: 'active', performance_score: 92 },
            { id: 'partner-2', business_name: 'Elite Study Abroad', primary_contact_name: 'David Lee', email: 'david@elitestudy.com', phone: '+919876543221', status: 'active', performance_score: 85 }
          ];
          parsedPartnerStudents = [
            {
              id: 'ps-student-1',
              partner_id: 'partner-1',
              first_name: 'Rahul',
              last_name: 'Sharma',
              email: 'rahul.sharma@outlook.com',
              phone: '+919988112233',
              whatsapp_number: '+919988112233',
              destination_country: 'Georgia',
              target_university: 'Tbilisi State Medical University',
              target_program: 'MBBS',
              academic_history: {},
              english_proficiency: {},
              crm_lead_id: null,
              application_status: 'referred',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            {
              id: 'ps-student-2',
              partner_id: 'partner-2',
              first_name: 'Sneha',
              last_name: 'Patel',
              email: 'sneha.patel@gmail.com',
              phone: '+919321456789',
              whatsapp_number: '+919321456789',
              destination_country: 'Philippines',
              target_university: 'University of Perpetual Help',
              target_program: 'MBBS',
              academic_history: {},
              english_proficiency: {},
              crm_lead_id: 'lead-4',
              application_status: 'converted',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ];
          parsedPartnerUploadedDocs = [
            {
              id: 'pud-1',
              student_id: 'ps-student-2',
              document_name: 'Passport Copy',
              file_url: 'https://example.com/docs/sneha_passport.pdf',
              file_name: 'sneha_passport.pdf',
              verification_status: 'verified',
              uploaded_at: new Date(Date.now() - 3600000 * 24).toISOString(),
              updated_at: new Date(Date.now() - 3600000 * 24).toISOString()
            },
            {
              id: 'pud-2',
              student_id: 'ps-student-2',
              document_name: '12th Marksheet',
              file_url: 'https://example.com/docs/sneha_12th.pdf',
              file_name: 'sneha_12th.pdf',
              verification_status: 'pending',
              uploaded_at: new Date(Date.now() - 3600000 * 12).toISOString(),
              updated_at: new Date(Date.now() - 3600000 * 12).toISOString()
            },
            {
              id: 'pud-3',
              student_id: 'ps-student-2',
              document_name: 'NEET Score Card',
              file_url: 'https://example.com/docs/sneha_neet.pdf',
              file_name: 'sneha_neet.pdf',
              verification_status: 'rejected',
              uploaded_at: new Date(Date.now() - 3600000 * 6).toISOString(),
              updated_at: new Date(Date.now() - 3600000 * 6).toISOString()
            },
            {
              id: 'pud-4',
              student_id: 'ps-student-1',
              document_name: 'Passport Copy',
              file_url: 'https://example.com/docs/rahul_passport.pdf',
              file_name: 'rahul_passport.pdf',
              verification_status: 'pending',
              uploaded_at: new Date(Date.now() - 3600000 * 48).toISOString(),
              updated_at: new Date(Date.now() - 3600000 * 48).toISOString()
            }
          ];

          localStorage.setItem(getLocalKey('crm_partners'), JSON.stringify(parsedPartners));
          localStorage.setItem(getLocalKey('crm_partner_students'), JSON.stringify(parsedPartnerStudents));
          localStorage.setItem(getLocalKey('crm_partner_uploaded_docs'), JSON.stringify(parsedPartnerUploadedDocs));
        }
 
        setPartners(parsedPartners);
        setPartnerStudents(parsedPartnerStudents);
        setPartnerUploadedDocs(parsedPartnerUploadedDocs);
 
        const storedColleges = localStorage.getItem(getLocalKey('crm_colleges'));
        const collegesSeeded = localStorage.getItem(getLocalKey('crm_colleges_seeded'));
        // Only seed on first ever load. After that, respect what admin has configured.
        let parsedColleges = storedColleges ? JSON.parse(storedColleges) : null;
        if (parsedColleges === null && !collegesSeeded && tenantId === 'default') {
          parsedColleges = [
            { id: 'univ-1', name: 'Tbilisi State Medical University', country: 'Georgia', required_docs: ['Passport Copy', '12th Marksheet', 'NEET Score Card', 'Birth Certificate', 'HIV Test Result'] },
            { id: 'univ-2', name: 'University of Perpetual Help', country: 'Philippines', required_docs: ['Passport Copy', '12th Marksheet', 'NEET Score Card', 'Medical Certificate'] }
          ];
          localStorage.setItem(getLocalKey('crm_colleges'), JSON.stringify(parsedColleges));
          localStorage.setItem(getLocalKey('crm_colleges_seeded'), 'true');
        } else if (parsedColleges === null) {
          parsedColleges = [];
        }
        setColleges(parsedColleges);

        // Seeding / loading mock pipelines
        const storedPipelines = localStorage.getItem(getLocalKey('crm_pipelines'));
        const storedPipelineAccess = localStorage.getItem(getLocalKey('crm_pipeline_access'));

        let parsedPipelines = storedPipelines ? JSON.parse(storedPipelines) : [];
        let parsedPipelineAccess = storedPipelineAccess ? JSON.parse(storedPipelineAccess) : [];

        const hasSales = parsedPipelines.some((p: Pipeline) => p.name === 'Sales Pipeline');
        const hasVisa = parsedPipelines.some((p: Pipeline) => p.name === 'Visa/Post-Closing Pipeline');

        if (!hasSales) {
          const defaultPipeline: Pipeline = {
            id: 'mock-pipeline-sales',
            name: 'Sales Pipeline',
            stages: parsedSettings.pipeline_stages || DEFAULT_PIPELINE_STAGES,
            tenant_id: tenantId,
            is_default: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          parsedPipelines.push(defaultPipeline);
          
          parsedProfiles.forEach((p: Profile) => {
            parsedPipelineAccess.push({
              id: `pa-${defaultPipeline.id}-${p.id}`,
              pipeline_id: defaultPipeline.id,
              profile_id: p.id,
              tenant_id: tenantId,
              created_at: new Date().toISOString()
            });
          });
        }

        if (!hasVisa) {
          const visaPipeline: Pipeline = {
            id: 'mock-pipeline-visa',
            name: 'Visa/Post-Closing Pipeline',
            stages: VISA_PIPELINE_STAGES,
            tenant_id: tenantId,
            is_default: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          parsedPipelines.push(visaPipeline);

          parsedProfiles.forEach((p: Profile) => {
            parsedPipelineAccess.push({
              id: `pa-${visaPipeline.id}-${p.id}`,
              pipeline_id: visaPipeline.id,
              profile_id: p.id,
              tenant_id: tenantId,
              created_at: new Date().toISOString()
            });
          });
        }

        if (!hasSales || !hasVisa) {
          localStorage.setItem(getLocalKey('crm_pipelines'), JSON.stringify(parsedPipelines));
          localStorage.setItem(getLocalKey('crm_pipeline_access'), JSON.stringify(parsedPipelineAccess));
        }

        setPipelines(parsedPipelines);
        setPipelineAccess(parsedPipelineAccess);

        const defaultPipe = parsedPipelines.find((p: Pipeline) => p.is_default) || parsedPipelines[0] || null;
        setActivePipeline(defaultPipe);

        const storedRedirLinks = localStorage.getItem(getLocalKey('crm_redirect_links'));
        setRedirectLinks(storedRedirLinks ? JSON.parse(storedRedirLinks) : []);
      }
      setIsLoading(false);
    };

    loadData();

    return () => {
      if (isDbActive && client && leadsChannel) {
        client.removeChannel(leadsChannel);
      }
    };
  }, [tenantId]);

  // Persistent writing for offline localStorage mode
  const saveLocal = (key: string, data: any) => {
    if (!isSupabaseConfigured || tenantId !== 'default') {
      localStorage.setItem(getStorageKey(key), JSON.stringify(data));
    }
  };

  // Auth Operations
  const login = async (email: string, role: UserRole, name: string, password?: string): Promise<Profile> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: password || 'password123' });
      if (error) throw error;

      const userId = data.user?.id;

      // Fetch profile for the session user (without tenant filter first!)
      let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!profile) {
        // Create profile if it doesn't exist
        const meta = data.user?.user_metadata || {};
        const newProfile = {
          id: userId,
          full_name: meta.full_name || email.split('@')[0],
          role: (meta.role as UserRole) || 'counsellor',
          phone: meta.phone || '',
          tenant_id: tenantId, // Fall back to current URL tenantId
        };
        await supabase.from('profiles').insert([newProfile]);
        profile = newProfile as Profile;
      } else if (!profile.tenant_id) {
        // If profile exists but has no tenant_id, patch it to current URL tenantId
        await supabase
          .from('profiles')
          .update({ tenant_id: tenantId })
          .eq('id', userId);
        profile.tenant_id = tenantId;
      }

      const prof = profile as Profile;
      
      // Update tenantId state to match profile tenant_id, triggering the reactive useEffect data reload
      const resolvedTenant = prof.tenant_id || 'default';
      setTenantId(resolvedTenant);
      setCurrentUser(prof);

      return prof;
    } else {
      // Find matching mock profile or create
      let matched = profiles.find(p => p.role === role && p.full_name.includes(name));
      if (!matched) {
        matched = {
          id: `mock-user-${Date.now()}`,
          full_name: name,
          role,
          created_at: new Date().toISOString(),
          tenant_id: tenantId
        };
        const updated = [...profiles, matched];
        setProfiles(updated);
        saveLocal('crm_profiles', updated);
      }
      setCurrentUser(matched);
      localStorage.setItem(getStorageKey('crm_user'), JSON.stringify(matched));
      return matched;
    }
  };

  const logout = () => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut();
    }
    setCurrentUser(null);
    localStorage.removeItem(getStorageKey('crm_user'));
  };

  const switchUser = (profile: Profile) => {
    setCurrentUser(profile);
    localStorage.setItem(getStorageKey('crm_user'), JSON.stringify(profile));
  };

  const updateProfileRole = async (profileId: string, role: UserRole) => {
    const updated = profiles.map(p => p.id === profileId ? { ...p, role } : p);
    setProfiles(updated);
    saveLocal('crm_profiles', updated);

    if (currentUser && currentUser.id === profileId) {
      const updatedUser = { ...currentUser, role };
      setCurrentUser(updatedUser);
      localStorage.setItem(getStorageKey('crm_user'), JSON.stringify(updatedUser));
    }

    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('profiles')
        .update({ role })
        .eq('id', profileId);
    }
  };

  const resetUserProfilePassword = async (profileId: string, newPassword: string) => {
    // 1. In Supabase mode, update it via backend API route
    if (isSupabaseConfigured && supabase) {
      const res = await fetch('/api/reset-user-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, newPassword })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to reset user password.');
      }
    }

    // 2. In Sandbox mode / LocalStorage mode, update credentials list
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(getStorageKey('crm_credentials'));
      if (stored) {
        const creds = JSON.parse(stored);
        const updatedCreds = creds.map((c: any) => {
          if (c.profileId === profileId) {
            return { ...c, password: newPassword };
          }
          return c;
        });
        localStorage.setItem(getStorageKey('crm_credentials'), JSON.stringify(updatedCreds));
      }
    }
  };

  const deleteUserProfile = async (profileId: string) => {
    // Update local state profiles array
    const updated = profiles.filter(p => p.id !== profileId);
    setProfiles(updated);
    saveLocal('crm_profiles', updated);

    // If deleting currently logged-in user, log them out
    if (currentUser && currentUser.id === profileId) {
      logout();
    }

    // Call Supabase backend delete-user API if configured
    if (isSupabaseConfigured && supabase) {
      const res = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete user account.');
      }
    }

    // Remove from mock credentials list
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(getStorageKey('crm_credentials'));
      if (stored) {
        const creds = JSON.parse(stored);
        const updatedCreds = creds.filter((c: any) => c.profileId !== profileId);
        localStorage.setItem(getStorageKey('crm_credentials'), JSON.stringify(updatedCreds));
      }
    }
  };

  const createUserProfile = async (email: string, role: UserRole, name: string, phone?: string, password?: string): Promise<Profile> => {
    const formattedPhone = phone ? (phone.startsWith('+') ? phone : `+91${phone}`) : undefined;
    let finalProfileId = `user-${Date.now()}`;

    // Call Supabase backend API route if configured to create user in auth.users
    if (isSupabaseConfigured && supabase) {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: password || 'counsellor123',
          name,
          role,
          phone: formattedPhone,
          tenant_id: tenantId
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create user in auth system.');
      }

      const data = await res.json();
      if (data.user && data.user.id) {
        finalProfileId = data.user.id;
      }
    }

    const newProf: Profile = {
      id: finalProfileId,
      full_name: name,
      role,
      phone: formattedPhone,
      email,
      created_at: new Date().toISOString(),
      tenant_id: tenantId
    };
    
    // Update local state and storage
    const updatedProfiles = [...profiles.filter(p => p.id !== finalProfileId), newProf];
    setProfiles(updatedProfiles);
    saveLocal('crm_profiles', updatedProfiles);

    // Save login credentials to sandbox localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(getStorageKey('crm_credentials'));
      const creds = stored ? JSON.parse(stored) : [];
      const alreadyExists = creds.some((c: any) => c.email.toLowerCase() === email.toLowerCase());
      if (!alreadyExists) {
        const updatedCreds = [...creds, {
          email,
          password: password || 'counsellor123',
          name,
          role,
          profileId: finalProfileId,
          phone: formattedPhone
        }];
        localStorage.setItem(getStorageKey('crm_credentials'), JSON.stringify(updatedCreds));
      }
    }


    // Trigger asynchronous Welcome Email dispatch with credentials
    try {
      const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      console.log(`Dispatching welcome credentials email for user ${email}...`);
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: 'Your Perfect Scholar CRM Consultant Account Details',
          html: `
            <div style="font-family: sans-serif; padding: 25px; color: #1e293b; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
              <h2 style="color: #4f46e5; font-size: 20px; font-weight: bold; margin-bottom: 20px;">Welcome to Perfect Scholar Workspace!</h2>
              <p style="font-size: 14px; color: #334155; line-height: 1.6;">Hello <strong>${name}</strong>,</p>
              <p style="font-size: 14px; color: #334155; line-height: 1.6;">An administrator has created a consultant account for you in the Perfect Scholar Lead Management CRM. Here are your credentials to sign in:</p>
              <div style="background-color: #f8fafc; padding: 15px; border-radius: 12px; margin: 20px 0; border: 1px dashed #cbd5e1;">
                <table style="width: 100%; font-size: 13px; color: #475569;">
                  <tr>
                    <td style="font-weight: bold; padding: 6px 0; width: 150px;">Workspace Link:</td>
                    <td style="padding: 6px 0;"><a href="${appOrigin}" style="color: #4f46e5; text-decoration: underline; font-weight: 600;">Perfect Scholar CRM Web</a></td>
                  </tr>
                  <tr>
                    <td style="font-weight: bold; padding: 6px 0;">Username/Email:</td>
                    <td style="padding: 6px 0; color: #0f172a; font-family: monospace; font-size: 14px;">${email}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: bold; padding: 6px 0;">Temporary Password:</td>
                    <td style="padding: 6px 0; color: #0f172a; font-family: monospace; font-size: 14px; font-weight: bold;">${password || 'counsellor123'}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: bold; padding: 6px 0;">Mobile Number:</td>
                    <td style="padding: 6px 0; color: #0f172a; font-family: monospace; font-size: 14px;">${formattedPhone || 'Not configured'}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: bold; padding: 6px 0;">Assigned Role:</td>
                    <td style="padding: 6px 0; text-transform: uppercase; font-weight: bold; color: #4f46e5;">${role}</td>
                  </tr>
                </table>
              </div>
              <p style="font-size: 13px; color: #64748b; line-height: 1.6;">You can log in to the web and mobile workspace using either your email address or your registered mobile phone number via secure SMS OTP code verification.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
              <p style="font-size: 11px; color: #94a3b8; text-align: center;">Perfect Scholar CRM • Lead Management Workspace</p>
            </div>
          `
        })
      });
    } catch (emailErr) {
      console.error("Welcome email delivery failed: ", emailErr);
    }

    return newProf;
  };


  const updateSettings = async (newSettings: Partial<CRMSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveLocal('crm_settings', updated);
    // Persist to database if Supabase is active
    if (isSupabaseConfigured && supabase) {
      // Exclude provider and encryption IV to ensure compatibility with older schemas
      const { whatsapp_provider, whatsapp_encryption_iv, ...cleanSettings } = updated as any;
      
      // Never upsert masked token back to the database, as that would overwrite the encrypted actual token
      if (cleanSettings.whatsapp_api_token && cleanSettings.whatsapp_api_token.startsWith('••••')) {
        delete cleanSettings.whatsapp_api_token;
      }

      const { error } = await supabase
        .from('settings')
        .upsert({ ...cleanSettings, tenant_id: tenantId });
      if (error) console.error('Failed to persist settings:', error.message);
    }
  };

  // Lead Operations
  const addLead = async (leadData: Omit<Lead, 'id' | 'created_at' | 'updated_at'>): Promise<Lead> => {
    const defaultPipelineId = leadData.pipeline_id || activePipeline?.id || pipelines.find(p => p.is_default)?.id || null;
    const newLeadItem = {
      ...leadData,
      pipeline_id: defaultPipelineId,
      id: `lead-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as Lead;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('leads')
        .insert([{
          ...leadData,
          pipeline_id: defaultPipelineId,
          tags: leadData.tags || [],
          score: leadData.score || 0,
          tenant_id: tenantId
        }])
        .select()
        .single();
      if (error) throw error;
      
      // Log Action
      await supabase.from('activity_logs').insert([{
        lead_id: data.id,
        actor_id: isValidUuid(currentUser?.id) ? currentUser?.id : null,
        action_type: 'lead_created',
        description: `Lead created from source: ${leadData.lead_source}`,
        tenant_id: tenantId
      }]);

      if (data) {
        setLeads(prev => [data as Lead, ...prev]);
      }
      return data as Lead;
    } else {
      // In local mode, store and simulate
      const updated = [newLeadItem, ...leads];
      setLeads(updated);
      saveLocal('crm_leads', updated);

      // Create local activity log
      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        lead_id: newLeadItem.id,
        actor_id: currentUser?.id || 'system',
        action_type: 'lead_created',
        description: `Lead created from source: ${newLeadItem.lead_source}`,
        created_at: new Date().toISOString()
      };
      const updatedLogs = [log, ...activityLogs];
      setActivityLogs(updatedLogs);
      saveLocal('crm_logs', updatedLogs);

      // Automated WhatsApp response trigger when lead enters
      setTimeout(() => {
        sendAutomatedWhatsAppWelcome(newLeadItem);
      }, 1500);

      return newLeadItem;
    }
  };
  const updateLead = async (id: string, updates: Partial<Lead>): Promise<Lead> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('leads')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();
      if (error) throw error;

      // Sync status change to partner portal student record if linked
      if (updates.status) {
        try {
          // Find the student linked to this crm lead
          const { data: student, error: studentFetchErr } = await supabase
            .from('partner_students')
            .select('id, first_name, last_name, partner_id')
            .eq('crm_lead_id', id)
            .maybeSingle();

          if (studentFetchErr) {
            console.error('[Notification Sync] Error fetching partner student:', studentFetchErr.message, studentFetchErr);
          }

          if (student) {
            // Update student status
            const { error: studentUpdateErr } = await supabase
              .from('partner_students')
              .update({ application_status: updates.status, updated_at: new Date().toISOString() })
              .eq('id', student.id);

            if (studentUpdateErr) {
              console.error('[Notification Sync] Error updating student status:', studentUpdateErr.message, studentUpdateErr);
            }

            // Fetch partner users for this partner agency to send push notifications
            const { data: partnerUsers, error: usersFetchErr } = await supabase
              .from('partner_users')
              .select('push_token')
              .eq('partner_id', student.partner_id)
              .not('push_token', 'is', null);

            if (usersFetchErr) {
              console.error('[Notification Sync] Error fetching partner users:', usersFetchErr.message, usersFetchErr);
            }

            if (partnerUsers && partnerUsers.length > 0) {
              const tokens = partnerUsers
                .map((u: any) => u.push_token)
                .filter((t: any) => typeof t === 'string' && (t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken')));

              if (tokens.length > 0) {
                const pushMessages = tokens.map(token => ({
                  to: token,
                  sound: 'default',
                  title: '🎓 Student Status Update',
                  body: `${student.first_name} ${student.last_name}'s application status changed to "${updates.status}".`,
                  data: { link: `student:${student.id}` }
                }));

                const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip, deflate',
                  },
                  body: JSON.stringify(pushMessages)
                });
                const pushJson = await pushRes.json().catch(() => null);
                console.log(`[Push] Expo API response:`, JSON.stringify(pushJson));
                if (!pushRes.ok) {
                  console.error('[Push] Expo push API HTTP error:', pushRes.status, pushJson);
                } else {
                  // Check for per-token errors
                  const results = Array.isArray(pushJson?.data) ? pushJson.data : (pushJson?.data ? [pushJson.data] : []);
                  results.forEach((r: any, i: number) => {
                    if (r?.status === 'error') {
                      console.error(`[Push] Token ${tokens[i]} failed:`, r.message, r.details);
                    } else {
                      console.log(`[Push] Token ${i} dispatched OK, id:`, r?.id);
                    }
                  });
                  console.log(`[Push] Dispatched status update push notification to partner users of agency ${student.partner_id}`);
                }
              }

            // Also insert an in-app announcement notification for the agency
            const { error: announceErr } = await supabase
              .from('partner_announcements')
              .insert([{
                title: '🎓 Student Status Update',
                content: `${student.first_name} ${student.last_name}'s application status changed to "${updates.status}".`,
                priority: 'normal',
                target_partner_id: student.partner_id,
                type: 'notification'
              }]);

            if (announceErr) {
              console.error('[Notification Sync] Error inserting in-app announcement:', announceErr.message, announceErr);
            }
          } else {
            console.log('[Notification Sync] No linked partner student found for lead ID:', id);
          }
        } catch (syncErr: any) {
          console.error("Failed to sync lead status to partner student:", syncErr.message || syncErr);
        }
      }

      // Log status change or update
      if (updates.status) {
        await supabase.from('activity_logs').insert([{
          lead_id: id,
          actor_id: isValidUuid(currentUser?.id) ? currentUser?.id : null,
          action_type: 'status_change',
          description: `Status changed to: ${updates.status}`,
          tenant_id: tenantId
        }]);

        // Trigger real-time status-based auto notification template
        let autoTemplateName = '';
        if (updates.status === 'Documents collected') autoTemplateName = 'docs-checklist';
        else if (updates.status === 'Offer Letter Received') autoTemplateName = 'offer-letter';
        else if (updates.status === 'Visa Approved') autoTemplateName = 'visa-approved';

        if (autoTemplateName && settings.whatsapp_phone_id) {
          fetch('/api/campaigns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filters: { status: updates.status },
              templateName: autoTemplateName,
              variables: ['name'],
              tenantId
            })
          }).catch(e => console.warn('[Auto-Notification] Meta Cloud dispatch failed:', e.message));
        }
      }  // closes: if (updates.status)
      if (data) {
        setLeads(prev => prev.map(l => l.id === id ? (data as Lead) : l));
      }
      return data as Lead;
    } else {
      const leadItem = leads.find(l => l.id === id);
      if (!leadItem) throw new Error("Lead not found");

      const updatedLeadItem: Lead = {
        ...leadItem,
        ...updates,
        updated_at: new Date().toISOString()
      };

      const updatedLeads = leads.map(l => l.id === id ? updatedLeadItem : l);

      setLeads(updatedLeads);
      saveLocal('crm_leads', updatedLeads);

      // Automated Visa Case Creation for Closed Won leads in Mock Mode
      if (updates.status === 'Closed Won' && leads.find(l => l.id === id)?.status !== 'Closed Won') {
        const exists = visaApplications.some(va => va.lead_id === id);
        if (!exists) {
          const newApp: VisaApplication = {
            id: `va-${Date.now()}`,
            lead_id: id,
            status: 'Document Collection',
            target_country: updatedLeadItem.preferred_destination || '',
            target_college: updatedLeadItem.course || '',
            travel_currency_exchanged: false,
            travel_insurance_done: false,
            travel_luggage_guidelines: false,
            travel_pickup_confirmed: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          const updatedApps = [newApp, ...visaApplications];
          setVisaApplications(updatedApps);
          saveLocal('crm_visa_apps', updatedApps);
        }
      }

      if (updates.status) {
        let autoTemplate = null;
        if (updates.status === 'Documents collected') autoTemplate = DEFAULT_TEMPLATES.find(t => t.id === 'docs-checklist');
        else if (updates.status === 'Offer Letter Received') autoTemplate = DEFAULT_TEMPLATES.find(t => t.id === 'offer-letter');
        else if (updates.status === 'Visa Approved') autoTemplate = DEFAULT_TEMPLATES.find(t => t.id === 'visa-approved');

        if (autoTemplate) {
          const body = autoTemplate.body.replace('{{lead_name}}', leadItem.name);
          const autoMessage = {
            id: `wa-auto-${Date.now()}`,
            lead_id: id,
            direction: 'outgoing',
            message_text: body,
            status: 'sent',
            created_at: new Date().toISOString()
          };
          setWhatsappHistory(prev => [autoMessage as any, ...prev]);
        }
      }

      // Log activity
      const actions: ActivityLog[] = [];
      if (updates.status) {
        actions.push({
          id: `log-${Date.now()}`,
          lead_id: id,
          actor_id: currentUser?.id || 'system',
          action_type: 'status_change',
          description: `Status updated to: ${updates.status}`,
          created_at: new Date().toISOString()
        });
      }
      if (updates.assigned_counsellor_id) {
        const counselor = profiles.find(p => p.id === updates.assigned_counsellor_id);
        actions.push({
          id: `log-${Date.now()}-2`,
          lead_id: id,
          actor_id: currentUser?.id || 'system',
          action_type: 'assigned',
          description: `Assigned to counsellor: ${counselor?.full_name || 'Unassigned'}`,
          created_at: new Date().toISOString()
        });
      }

      if (actions.length > 0) {
        const updatedLogs = [...actions, ...activityLogs];
        setActivityLogs(updatedLogs);
        saveLocal('crm_logs', updatedLogs);
      }

      return updatedLeadItem;
    }
  };

  const deleteLead = async (id: string): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('leads').delete().eq('id', id).eq('tenant_id', tenantId);
      if (error) throw error;
      setLeads(prev => prev.filter(l => l.id !== id));
    } else {
      const updated = leads.filter(l => l.id !== id);
      setLeads(updated);
      saveLocal('crm_leads', updated);
    }
  };

  const deleteLeads = async (ids: string[]): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('leads').delete().in('id', ids).eq('tenant_id', tenantId);
      if (error) throw error;
      setLeads(prev => prev.filter(l => !ids.includes(l.id)));
    } else {
      const updated = leads.filter(l => !ids.includes(l.id));
      setLeads(updated);
      saveLocal('crm_leads', updated);
    }
  };

  const bulkAddLeads = async (leadsData: Omit<Lead, 'id' | 'created_at' | 'updated_at'>[]): Promise<Lead[]> => {
    if (leadsData.length === 0) return [];
    const defaultPipelineId = activePipeline?.id || pipelines.find(p => p.is_default)?.id || null;
    const nowStr = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      const dbLeads = leadsData.map((leadData) => ({
        ...leadData,
        pipeline_id: leadData.pipeline_id || defaultPipelineId,
        tags: leadData.tags || [],
        score: leadData.score || 0,
        tenant_id: tenantId
      }));

      const { data, error } = await supabase
        .from('leads')
        .insert(dbLeads)
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        const logs = data.map(lead => ({
          lead_id: lead.id,
          actor_id: isValidUuid(currentUser?.id) ? currentUser?.id : null,
          action_type: 'lead_created',
          description: `Lead imported from CSV file`,
          tenant_id: tenantId
        }));
        await supabase.from('activity_logs').insert(logs);

        setLeads(prev => {
          const newLeads = (data as Lead[]).filter(nl => !prev.some(pl => pl.id === nl.id));
          return [...newLeads, ...prev];
        });
      }

      return data as Lead[];
    } else {
      const newLeads = leadsData.map((leadData, index) => ({
        ...leadData,
        pipeline_id: leadData.pipeline_id || defaultPipelineId,
        id: `lead-import-${Date.now()}-${index}`,
        created_at: nowStr,
        updated_at: nowStr
      })) as Lead[];

      const updated = [...newLeads, ...leads];
      setLeads(updated);
      saveLocal('crm_leads', updated);

      const logs: ActivityLog[] = newLeads.map((nl, index) => ({
        id: `log-import-${Date.now()}-${index}`,
        lead_id: nl.id,
        actor_id: currentUser?.id || 'system',
        action_type: 'lead_created',
        description: `Lead imported from CSV file`,
        created_at: nowStr
      }));
      const updatedLogs = [...logs, ...activityLogs];
      setActivityLogs(updatedLogs);
      saveLocal('crm_logs', updatedLogs);

      return newLeads;
    }
  };

  // Notes
  const addNote = async (leadId: string, content: string): Promise<Note> => {
    const newNote: Note = {
      id: `note-${Date.now()}`,
      lead_id: leadId,
      author_id: currentUser?.id || 'system',
      content,
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('notes')
        .insert([{ lead_id: leadId, author_id: isValidUuid(currentUser?.id) ? currentUser?.id : null, content, tenant_id: tenantId }])
        .select()
        .single();
      if (error) throw error;
      
      await supabase.from('activity_logs').insert([{
        lead_id: leadId,
        actor_id: isValidUuid(currentUser?.id) ? currentUser?.id : null,
        action_type: 'note_added',
        description: `Added internal team note: "${content.substring(0, 40)}${content.length > 40 ? '...' : ''}"`,
        tenant_id: tenantId
      }]);

      if (data) {
        setNotes(prev => [data as Note, ...prev]);
      }
      return data as Note;
    } else {
      const updated = [newNote, ...notes];
      setNotes(updated);
      saveLocal('crm_notes', updated);

      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        lead_id: leadId,
        actor_id: currentUser?.id || 'system',
        action_type: 'note_added',
        description: `Added note: "${content.substring(0, 40)}${content.length > 40 ? '...' : ''}"`,
        created_at: new Date().toISOString()
      };
      const updatedLogs = [log, ...activityLogs];
      setActivityLogs(updatedLogs);
      saveLocal('crm_logs', updatedLogs);

      return newNote;
    }
  };

  // Tasks
  const addTask = async (leadId: string, title: string, dueDate?: string): Promise<Task> => {
    const finalDueDate = dueDate ? new Date(dueDate).toISOString() : new Date(Date.now() + 86400000 * 2).toISOString();
    const newTask: Task = {
      id: `task-${Date.now()}`,
      lead_id: leadId,
      assignee_id: currentUser?.id || 'system',
      title,
      due_date: finalDueDate,
      is_completed: false,
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ lead_id: leadId, assignee_id: isValidUuid(currentUser?.id) ? currentUser?.id : null, title, due_date: finalDueDate, tenant_id: tenantId }])
        .select()
        .single();
      if (error) throw error;

      await supabase.from('activity_logs').insert([{
        lead_id: leadId,
        actor_id: isValidUuid(currentUser?.id) ? currentUser?.id : null,
        action_type: 'task_created',
        description: `Created task: "${title}"`,
        tenant_id: tenantId
      }]);

      if (data) {
        setTasks(prev => [data as Task, ...prev]);
      }
      return data as Task;
    } else {
      const updated = [newTask, ...tasks];
      setTasks(updated);
      saveLocal('crm_tasks', updated);

      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        lead_id: leadId,
        actor_id: currentUser?.id || 'system',
        action_type: 'task_created',
        description: `Created task: "${title}"`,
        created_at: new Date().toISOString()
      };
      const updatedLogs = [log, ...activityLogs];
      setActivityLogs(updatedLogs);
      saveLocal('crm_logs', updatedLogs);

      return newTask;
    }
  };

  const toggleTask = async (taskId: string): Promise<Task> => {
    const taskToToggle = tasks.find(t => t.id === taskId);
    if (!taskToToggle) throw new Error("Task not found");
    const nextCompleted = !taskToToggle.is_completed;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('tasks')
        .update({ is_completed: nextCompleted })
        .eq('id', taskId)
        .eq('tenant_id', tenantId)
        .select()
        .single();
      if (error) throw error;
      
      await supabase.from('activity_logs').insert([{
        lead_id: taskToToggle.lead_id,
        actor_id: isValidUuid(currentUser?.id) ? currentUser?.id : null,
        action_type: 'task_completed',
        description: `Marked task "${taskToToggle.title}" as ${nextCompleted ? 'completed' : 'incomplete'}`,
        tenant_id: tenantId
      }]);

      if (data) {
        setTasks(prev => prev.map(t => t.id === taskId ? (data as Task) : t));
      }
      return data as Task;
    } else {
      const updatedTasks = tasks.map(t => {
        if (t.id === taskId) return { ...t, is_completed: nextCompleted };
        return t;
      });
      setTasks(updatedTasks);
      saveLocal('crm_tasks', updatedTasks);

      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        lead_id: taskToToggle.lead_id,
        actor_id: currentUser?.id || 'system',
        action_type: 'task_completed',
        description: `Marked task "${taskToToggle.title}" as ${nextCompleted ? 'completed' : 'incomplete'}`,
        created_at: new Date().toISOString()
      };
      const updatedLogs = [log, ...activityLogs];
      setActivityLogs(updatedLogs);
      saveLocal('crm_logs', updatedLogs);

      return { ...taskToToggle, is_completed: nextCompleted };
    }
  };

  // WhatsApp Send Simulated Messages
  const sendAutomatedWhatsAppWelcome = (lead: Lead) => {
    const welcomeTemplate = DEFAULT_TEMPLATES.find(t => t.id === 'welcome');
    if (!welcomeTemplate) return;

    let body = welcomeTemplate.body
      .replace('{{lead_name}}', lead.name)
      .replace('{{preferred_destination}}', lead.preferred_destination || 'Abroad');

    const autoMessage: WhatsAppMessage = {
      id: `wa-${Date.now()}`,
      lead_id: lead.id,
      direction: 'outgoing',
      message_text: body,
      status: 'delivered',
      created_at: new Date().toISOString()
    };

    const updatedHist = [autoMessage, ...whatsappHistory];
    setWhatsappHistory(updatedHist);
    saveLocal('crm_whist', updatedHist);

    // Update status to 'Discussion stage'
    updateLead(lead.id, { status: 'Discussion stage' });
  };

  const sendWhatsAppTemplate = async (leadId: string, templateId: string): Promise<void> => {
    const lead = leads.find(l => l.id === leadId);
    const template = whatsappTemplates.find(t => t.id === templateId);
    if (!lead || !template) return;

    // Replace both standard numbered placeholders and legacy named placeholders
    let body = template.body;
    body = body.replace(/\{\{1\}\}/g, lead.name || '');
    body = body.replace(/\{\{2\}\}/g, lead.course || 'MBBS');
    body = body.replace(/\{\{3\}\}/g, lead.preferred_destination || 'Georgia/Russia');
    body = body.replace(/\{\{4\}\}/g, lead.budget ? `₹${lead.budget}` : '');

    body = body
      .replace(/\{\{lead_name\}\}/gi, lead.name || '')
      .replace(/\{\{neet_marks\}\}/gi, String(lead.neet_marks || 200))
      .replace(/\{\{budget\}\}/gi, lead.budget ? `${(lead.budget / 100000).toFixed(1)} Lakh` : '40 Lakh')
      .replace(/\{\{preferred_destination\}\}/gi, lead.preferred_destination || 'Georgia/Russia');

    if (template.attachment_url) {
      body += `\n\n📄 Document: ${template.attachment_url}`;
    }

    const newMessage: WhatsAppMessage = {
      id: `wa-${Date.now()}`,
      lead_id: leadId,
      direction: 'outgoing',
      message_text: body,
      status: 'sent',
      created_at: new Date().toISOString()
    };

    // Attempt background sending via Meta Cloud API
    let sentViaApi = false;
    const targetPhone = lead.whatsapp_number || lead.phone;
    if (targetPhone && targetPhone !== '#') {
      try {
        const paramValues: string[] = [
          lead.name || '',
          lead.course || 'MBBS',
          lead.preferred_destination || 'Georgia/Russia',
          lead.budget ? `₹${lead.budget}` : ''
        ];

        const apiRes = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            to: targetPhone,
            type: 'template',
            templateName: template.name,
            variables: paramValues
          })
        });

        if (apiRes.ok) {
          sentViaApi = true;
          console.log('[WhatsApp] Template successfully sent in background via Meta API.');
        } else {
          const errData = await apiRes.json();
          console.warn('[WhatsApp] Meta API template send failed, falling back to manual redirect:', errData.error);
        }
      } catch (err) {
        console.warn('[WhatsApp] Network error, falling back to manual redirect:', err);
      }
    }

    // Fallback: Open WhatsApp Web/Desktop App directly on computer if API is not active
    if (!sentViaApi && typeof window !== 'undefined' && targetPhone) {
      let cleanPhone = targetPhone.replace(/[^0-9]/g, '');
      if (cleanPhone.length === 10) {
        cleanPhone = `91${cleanPhone}`;
      } else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
        cleanPhone = `91${cleanPhone.substring(1)}`;
      }
      const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(body)}`;
      window.open(waUrl, '_blank');
    }

    if (isSupabaseConfigured && supabase) {
      await supabase.from('whatsapp_history').insert([{ ...newMessage, tenant_id: tenantId }]);
      await supabase.from('activity_logs').insert([{
        lead_id: leadId,
        actor_id: isValidUuid(currentUser?.id) ? currentUser?.id : null,
        action_type: 'whatsapp_sent',
        description: `Sent WhatsApp template: "${template.name}"`,
        tenant_id: tenantId
      }]);
    } else {
      const updated = [newMessage, ...whatsappHistory];
      setWhatsappHistory(updated);
      saveLocal('crm_whist', updated);

      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        lead_id: leadId,
        actor_id: currentUser?.id || 'system',
        action_type: 'whatsapp_sent',
        description: `Sent WhatsApp template: "${template.name}"`,
        created_at: new Date().toISOString()
      };
      const updatedLogs = [log, ...activityLogs];
      setActivityLogs(updatedLogs);
      saveLocal('crm_logs', updatedLogs);

      // Simulate status check update
      setTimeout(() => {
        setWhatsappHistory(prev => prev.map(m => m.id === newMessage.id ? { ...m, status: 'read' } : m));
      }, 2000);
    }
  };

  const sendCustomWhatsApp = async (leadId: string, message: string): Promise<void> => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    const newMessage: WhatsAppMessage = {
      id: `wa-${Date.now()}`,
      lead_id: leadId,
      direction: 'outgoing',
      message_text: message,
      status: 'sent',
      created_at: new Date().toISOString()
    };

    // Attempt background sending via Meta Cloud API
    let sentViaApi = false;
    const targetPhone = lead.whatsapp_number || lead.phone;
    if (targetPhone && targetPhone !== '#') {
      try {
        const apiRes = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            to: targetPhone,
            type: 'text',
            message: message
          })
        });

        if (apiRes.ok) {
          sentViaApi = true;
          console.log('[WhatsApp] Custom message successfully sent in background via Meta API.');
        } else {
          const errData = await apiRes.json();
          console.warn('[WhatsApp] Meta API manual send failed, falling back to manual redirect:', errData.error);
        }
      } catch (err) {
        console.warn('[WhatsApp] Network error, falling back to manual redirect:', err);
      }
    }

    // Fallback: Open WhatsApp Web/Desktop App directly on computer if API is not active
    if (!sentViaApi && typeof window !== 'undefined' && targetPhone) {
      let cleanPhone = targetPhone.replace(/[^0-9]/g, '');
      if (cleanPhone.length === 10) {
        cleanPhone = `91${cleanPhone}`;
      } else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
        cleanPhone = `91${cleanPhone.substring(1)}`;
      }
      const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');
    }

    if (isSupabaseConfigured && supabase) {
      await supabase.from('whatsapp_history').insert([{ ...newMessage, tenant_id: tenantId }]);
      await supabase.from('activity_logs').insert([{
        lead_id: leadId,
        actor_id: isValidUuid(currentUser?.id) ? currentUser?.id : null,
        action_type: 'whatsapp_sent',
        description: `Sent manual WhatsApp: "${message.substring(0, 30)}..."`,
        tenant_id: tenantId
      }]);
    } else {
      const updated = [newMessage, ...whatsappHistory];
      setWhatsappHistory(updated);
      saveLocal('crm_whist', updated);

      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        lead_id: leadId,
        actor_id: currentUser?.id || 'system',
        action_type: 'whatsapp_sent',
        description: `Sent manual WhatsApp: "${message.substring(0, 30)}..."`,
        created_at: new Date().toISOString()
      };
      const updatedLogs = [log, ...activityLogs];
      setActivityLogs(updatedLogs);
      saveLocal('crm_logs', updatedLogs);

      // Simulate client reading and replying in 4 seconds
      setTimeout(() => {
        setWhatsappHistory(prev => prev.map(m => m.id === newMessage.id ? { ...m, status: 'read' } : m));
        
        // Simulating incoming reply
        setTimeout(() => {
          const replyText = getMockReply(message);
          const incomingMessage: WhatsAppMessage = {
            id: `wa-${Date.now() + 1}`,
            lead_id: leadId,
            direction: 'incoming',
            message_text: replyText,
            status: 'read',
            created_at: new Date().toISOString()
          };
          setWhatsappHistory(prev => [incomingMessage, ...prev]);

          const incomingLog: ActivityLog = {
            id: `log-${Date.now() + 2}`,
            lead_id: leadId,
            actor_id: 'system',
            action_type: 'whatsapp_received',
            description: `Received WhatsApp: "${replyText.substring(0, 30)}..."`,
            created_at: new Date().toISOString()
          };
          setActivityLogs(prev => [incomingLog, ...prev]);

          // Notify browser if supported
          if (Notification.permission === 'granted') {
            new Notification(`New WhatsApp from ${leads.find(l => l.id === leadId)?.name || 'Lead'}`, {
              body: replyText
            });
          }
        }, 3000);
      }, 1500);
    }
  };

  const getMockReply = (outgoingText: string): string => {
    const text = outgoingText.toLowerCase();
    if (text.includes('budget') || text.includes('fees')) {
      return "My total budget is around 50-60 Lakhs for the whole 6-year course including hostel. Can you suggest colleges?";
    }
    if (text.includes('checklist') || text.includes('documents')) {
      return "Yes, I will share the PDF marksheet and NEET scorecard of my son by tonight. Thank you!";
    }
    if (text.includes('neet') || text.includes('marks')) {
      return "My NEET score is 490. Are we eligible for top Georgia universities?";
    }
    return "Thanks for details. What is the next step for admission process? Can we schedule a video call?";
  };

  const addWhatsAppTemplate = async (templateData: Omit<WhatsAppTemplate, 'id' | 'created_at'>): Promise<WhatsAppTemplate> => {
    const newTemplate = {
      ...templateData,
      id: `temp-${Date.now()}`,
      created_at: new Date().toISOString()
    } as WhatsAppTemplate;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .insert([{ ...templateData, tenant_id: tenantId }])
        .select()
        .single();
      if (error) throw error;
      return data as WhatsAppTemplate;
    } else {
      const updated = [...whatsappTemplates, newTemplate];
      setWhatsappTemplates(updated);
      saveLocal('crm_whatsapp_templates', updated);
      return newTemplate;
    }
  };

  const updateWhatsAppTemplate = async (id: string, updates: Partial<Omit<WhatsAppTemplate, 'id' | 'created_at'>>): Promise<WhatsAppTemplate> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .update(updates)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();
      if (error) throw error;
      return data as WhatsAppTemplate;
    } else {
      let updatedTemplate: WhatsAppTemplate | null = null;
      const updatedTemplates = whatsappTemplates.map(t => {
        if (t.id === id) {
          updatedTemplate = { ...t, ...updates };
          return updatedTemplate;
        }
        return t;
      });
      if (!updatedTemplate) throw new Error("Template not found");
      setWhatsappTemplates(updatedTemplates);
      saveLocal('crm_whatsapp_templates', updatedTemplates);
      return updatedTemplate;
    }
  };

  const deleteWhatsAppTemplate = async (id: string): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('whatsapp_templates')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);
      if (error) throw error;
      setWhatsappTemplates(prev => prev.filter(t => t.id !== id));
    } else {
      const updated = whatsappTemplates.filter(t => t.id !== id);
      setWhatsappTemplates(updated);
      saveLocal('crm_whatsapp_templates', updated);
    }
  };

  const uploadAttachment = async (file: File): Promise<{ url: string; name: string }> => {
    if (isSupabaseConfigured && supabase) {
      const bucketName = 'whatsapp_attachments';
      const fileKey = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      
      // Attempt upload
      let { data, error } = await supabase.storage.from(bucketName).upload(fileKey, file, {
        cacheControl: '3600',
        upsert: false
      });
      
      if (error) {
        // Try creating bucket if it doesn't exist
        try {
          await supabase.storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 10485760 // 10MB
          });
          
          // Retry upload
          const retryResult = await supabase.storage.from(bucketName).upload(fileKey, file, {
            cacheControl: '3600',
            upsert: false
          });
          if (retryResult.error) throw retryResult.error;
          data = retryResult.data;
        } catch (bucketErr: any) {
          throw new Error(error.message || "Failed to upload file to storage.");
        }
      }
      
      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(fileKey);
      return {
        url: urlData.publicUrl,
        name: file.name
      };
    } else {
      // Offline mock simulation
      await new Promise(resolve => setTimeout(resolve, 1000));
      return {
        url: `https://gkayyfwadwwsucpqeefw.supabase.co/storage/v1/object/public/whatsapp_attachments/${Date.now()}_${file.name.replace(/\s+/g, '_')}`,
        name: file.name
      };
    }
  };

  // Simulate a lead coming in from Facebook Ads/Google Ads
  const triggerLeadSimulation = () => {
    const names = ['Rakesh Gupta', 'Meera Deshmukh', 'Tarun Sen', 'Devika Nair', 'Aman Oberoi'];
    const destinations = ['Georgia', 'Russia', 'Philippines', 'Uzbekistan', 'Bangladesh'];
    const sources = ['Facebook Ads', 'Instagram Ads', 'Google Ads', 'Website Form', 'TikTok'];
    const campaigns = ['MBBS 2026 Admissions', 'Low Cost Medical Colleges', 'Study Abroad Guide', 'NEET Direct Callout'];
    const courses = [
      'MBBS',
      'MBBS Abroad',
      'Computer Science Engineering',
      'Mechanical Engineering',
      'Electrical Engineering',
      'Nursing',
      'MBA',
      'Other'
    ];
    
    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomDest = destinations[Math.floor(Math.random() * destinations.length)];
    const randomSource = sources[Math.floor(Math.random() * sources.length)];
    const randomCamp = campaigns[Math.floor(Math.random() * campaigns.length)];
    const randomNeet = Math.floor(Math.random() * 450) + 150; // 150 to 600
    const randomBudget = (Math.floor(Math.random() * 8) + 4) * 1000000; // 40L to 1.1Cr
    const randomCounsellor = Math.random() > 0.3 ? profiles.find(p => p.role === 'counsellor')?.id || null : null;

    let selectedCourse = 'MBBS';
    if (settings.form_integration_strategy === 'fixed') {
      selectedCourse = settings.form_integration_fixed_course || 'MBBS';
    } else {
      selectedCourse = courses[Math.floor(Math.random() * courses.length)];
    }

    const simulatedLeadData: Omit<Lead, 'id' | 'created_at' | 'updated_at'> = {
      name: `${randomName} (${Date.now().toString().slice(-4)})`,
      email: `${randomName.toLowerCase().replace(' ', '.')}@gmail.com`,
      phone: `+919${Math.floor(100000000 + Math.random() * 900000000)}`,
      parent_contact: `+919${Math.floor(100000000 + Math.random() * 900000000)}`,
      neet_marks: randomNeet,
      budget: randomBudget,
      preferred_destination: randomDest,
      course: selectedCourse,
      lead_source: randomSource,
      campaign_name: randomCamp,
      adset_name: 'NEET 250+ Qualified',
      creative_name: 'Grid Collage Image AD',
      utm_source: randomSource.split(' ')[0].toLowerCase(),
      utm_medium: 'cpc',
      utm_campaign: randomCamp.toLowerCase().replace(/ /g, '_'),
      landing_page_url: `https://mbbsconsultancy.com/${randomDest.toLowerCase()}-landing`,
      status: '1st followup',
      assigned_counsellor_id: randomCounsellor,
      tags: [randomDest, 'Lead Simulation'],
      score: randomNeet > 400 ? 80 : 50
    };

    addLead(simulatedLeadData);

    // Browser Notification
    if (Notification.permission === 'granted') {
      new Notification(`🔥 New Simulated Lead!`, {
        body: `${simulatedLeadData.name} applied for ${simulatedLeadData.course} from ${simulatedLeadData.lead_source}`
      });
    }
  };

  // New Visa Processing Actions
  const updateVisaApplication = async (id: string, updates: Partial<VisaApplication>): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('visa_applications')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('tenant_id', tenantId);
      if (error) throw error;
    } else {
      const updated = visaApplications.map(va => {
        if (va.id === id) {
          return {
            ...va,
            ...updates,
            updated_at: new Date().toISOString()
          };
        }
        return va;
      });
      setVisaApplications(updated);
      saveLocal('crm_visa_apps', updated);
    }
  };

  const saveVisaRequiredDoc = async (country: string, documentName: string, isRequired: boolean): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('visa_required_docs')
        .upsert({
          country,
          document_name: documentName,
          is_required: isRequired,
          tenant_id: tenantId
        }, { onConflict: 'country,document_name' });
      if (error) throw error;
    } else {
      let exists = false;
      const updated = visaRequiredDocs.map(vrd => {
        if (vrd.country === country && vrd.document_name === documentName) {
          exists = true;
          return { ...vrd, is_required: isRequired };
        }
        return vrd;
      });
      if (exists) {
        setVisaRequiredDocs(updated);
        saveLocal('crm_visa_req_docs', updated);
      } else {
        const newDoc: VisaRequiredDoc = {
          id: `vrd-${Date.now()}`,
          country,
          document_name: documentName,
          is_required: isRequired,
          created_at: new Date().toISOString()
        };
        const updatedDocs = [...visaRequiredDocs, newDoc];
        setVisaRequiredDocs(updatedDocs);
        saveLocal('crm_visa_req_docs', updatedDocs);
      }
    }
  };

  const deleteVisaRequiredDoc = async (id: string): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('visa_required_docs')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);
      if (error) throw error;
    } else {
      const updated = visaRequiredDocs.filter(vrd => vrd.id !== id);
      setVisaRequiredDocs(updated);
      saveLocal('crm_visa_req_docs', updated);
    }
  };

  const uploadVisaDoc = async (visaApplicationId: string, documentName: string, file: File, isIssuance: boolean = false): Promise<void> => {
    let fileUrl = '';
    let fileName = file.name;

    if (isSupabaseConfigured && supabase) {
      const bucketName = 'visa_documents';
      const fileKey = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      
      let { data, error } = await supabase.storage.from(bucketName).upload(fileKey, file, {
        cacheControl: '3600',
        upsert: false
      });
      
      if (error) {
        try {
          await supabase.storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 10485760 // 10MB
          });
          
          const retryResult = await supabase.storage.from(bucketName).upload(fileKey, file, {
            cacheControl: '3600',
            upsert: false
          });
          if (retryResult.error) throw retryResult.error;
          data = retryResult.data;
        } catch (bucketErr: any) {
          throw new Error(error.message || "Failed to upload file to storage.");
        }
      }
      
      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(fileKey);
      fileUrl = urlData.publicUrl;
    } else {
      fileUrl = `https://mockstorage.com/visa_documents/${Date.now()}_${file.name}`;
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('visa_uploaded_docs')
        .upsert({
          visa_application_id: visaApplicationId,
          document_name: documentName,
          file_url: fileUrl,
          file_name: fileName,
          is_issuance: isIssuance,
          status: 'pending',
          updated_at: new Date().toISOString(),
          tenant_id: tenantId
        }, { onConflict: 'visa_application_id,document_name' });
      if (error) throw error;

      if (isIssuance) {
        // Trigger in-app and push notifications for the partner portal
        (async () => {
          try {
            // Find the lead associated with this visa application
            const { data: vApp } = await supabase
              .from('visa_applications')
              .select('lead_id')
              .eq('id', visaApplicationId)
              .single();

            if (vApp?.lead_id) {
              // Find the student record linked to this lead
              const { data: student } = await supabase
                .from('partner_students')
                .select('id, first_name, last_name, partner_id')
                .eq('crm_lead_id', vApp.lead_id)
                .single();

              if (student) {
                const studentName = `${student.first_name} ${student.last_name}`;

                // 1. Insert in-app notification entry
                await supabase
                  .from('partner_announcements')
                  .insert([{
                    title: '📄 Visa Document Issued',
                    content: `CRM admin uploaded visa document "${documentName}" for student ${studentName}.`,
                    priority: 'normal',
                    target_partner_id: student.partner_id,
                    type: 'notification'
                  }]);

                // 2. Fetch partner users and send push notifications via Expo API
                const { data: partnerUsers } = await supabase
                  .from('partner_users')
                  .select('push_token')
                  .eq('partner_id', student.partner_id)
                  .not('push_token', 'is', null);

                if (partnerUsers && partnerUsers.length > 0) {
                  const tokens = partnerUsers
                    .map((u: any) => u.push_token)
                    .filter((t: any) => typeof t === 'string' && (t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken')));

                  if (tokens.length > 0) {
                    const pushMessages = tokens.map(token => ({
                      to: token,
                      sound: 'default',
                      title: '📄 Visa Document Issued',
                      body: `CRM admin uploaded visa document "${documentName}" for student ${studentName}.`,
                      data: { link: `student:${student.id}`, studentId: student.id }
                    }));

                    await fetch('https://exp.host/--/api/v2/push/send', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(pushMessages)
                    });
                    console.log(`[Push] Dispatched visa document upload push notification to partner users of agency ${student.partner_id}`);
                  }
                }
              }
            }
          } catch (notifErr) {
            console.error('[Visa Upload Notification] Failed to send notifications:', notifErr);
          }
        })();
      }
    } else {
      let exists = false;
      const updated = visaUploadedDocs.map(vud => {
        if (vud.visa_application_id === visaApplicationId && vud.document_name === documentName) {
          exists = true;
          return {
            ...vud,
            file_url: fileUrl,
            file_name: fileName,
            is_issuance: isIssuance,
            status: 'pending' as const,
            updated_at: new Date().toISOString()
          };
        }
        return vud;
      });

      if (exists) {
        setVisaUploadedDocs(updated);
        saveLocal('crm_visa_up_docs', updated);
      } else {
        const newUpDoc: VisaUploadedDoc = {
          id: `vud-${Date.now()}`,
          visa_application_id: visaApplicationId,
          document_name: documentName,
          file_url: fileUrl,
          file_name: fileName,
          status: 'pending',
          is_issuance: isIssuance,
          uploaded_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        const updatedDocs = [newUpDoc, ...visaUploadedDocs];
        setVisaUploadedDocs(updatedDocs);
        saveLocal('crm_visa_up_docs', updatedDocs);
      }
    }
  };

  const deleteVisaDoc = async (id: string): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('visa_uploaded_docs')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);
      if (error) throw error;
    } else {
      const updated = visaUploadedDocs.filter(vud => vud.id !== id);
      setVisaUploadedDocs(updated);
      saveLocal('crm_visa_up_docs', updated);
    }
  };

  const verifyVisaDoc = async (id: string, status: 'verified' | 'rejected'): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('visa_uploaded_docs')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('tenant_id', tenantId);
      if (error) throw error;

      // Update state so the UI updates immediately
      setVisaUploadedDocs(prev => prev.map(vud => {
        if (vud.id === id) {
          return {
            ...vud,
            status,
            updated_at: new Date().toISOString()
          };
        }
        return vud;
      }));

      // Trigger background push notification to consultant
      (async () => {
        try {
          const { data: vDocData } = await supabase
            .from('visa_uploaded_docs')
            .select('document_name, visa_application_id')
            .eq('id', id)
            .single();

          if (vDocData?.visa_application_id) {
            const { data: vAppData } = await supabase
              .from('visa_applications')
              .select('lead_id')
              .eq('id', vDocData.visa_application_id)
              .single();

            if (vAppData?.lead_id) {
              const { data: studentData } = await supabase
                .from('partner_students')
                .select('id, first_name, last_name, submitted_by')
                .eq('crm_lead_id', vAppData.lead_id)
                .single();

              if (studentData?.submitted_by) {
                const { data: userData } = await supabase
                  .from('partner_users')
                  .select('push_token')
                  .eq('id', studentData.submitted_by)
                  .single();

                if (userData?.push_token && (userData.push_token.startsWith('ExponentPushToken') || userData.push_token.startsWith('ExpoPushToken'))) {
                  const studentName = `${studentData.first_name} ${studentData.last_name}`;
                  const title = status === 'verified' ? 'Visa Document Approved' : 'Visa Document Rejected';
                  const body = status === 'verified'
                    ? `Great news! The visa document "${vDocData.document_name}" for ${studentName} has been approved.`
                    : `Attention: The visa document "${vDocData.document_name}" for ${studentName} was rejected. Please review and re-upload.`;

                  await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: {
                      'Accept': 'application/json',
                      'Accept-encoding': 'gzip, deflate',
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      to: userData.push_token,
                      title,
                      body,
                      sound: 'default',
                      data: { link: `student:${studentData.id}`, studentId: studentData.id, documentName: vDocData.document_name }
                    })
                  });
                  console.log(`[Push Notification] Dispatched successfully to consultant ${studentData.submitted_by} for student ${studentName}`);
                }
              }
            }
          }
        } catch (pushErr: any) {
          console.error("Error triggering push notification for visa document verification:", pushErr);
        }
      })();
    } else {
      const updated = visaUploadedDocs.map(vud => {
        if (vud.id === id) {
          return {
            ...vud,
            status,
            updated_at: new Date().toISOString()
          };
        }
        return vud;
      });
      setVisaUploadedDocs(updated);
      saveLocal('crm_visa_up_docs', updated);
    }
  };

  const sendVisaDocToStudent = async (uploadedDocId: string): Promise<void> => {
    const doc = visaUploadedDocs.find(vud => vud.id === uploadedDocId);
    if (!doc) return;
    const vApp = visaApplications.find(va => va.id === doc.visa_application_id);
    if (!vApp) return;
    const lead = leads.find(l => l.id === vApp.lead_id);
    if (!lead) return;

    const message = `Hello ${lead.name}, your official ${doc.document_name} for ${vApp.target_college || lead.course || 'your selected college'} has been issued! You can view and download it here: ${doc.file_url}`;
    
    if (typeof window !== 'undefined') {
      const targetPhone = lead.whatsapp_number || lead.phone;
      let cleanPhone = targetPhone.replace(/[^0-9]/g, '');
      if (cleanPhone.length === 10) {
        cleanPhone = `91${cleanPhone}`;
      } else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
        cleanPhone = `91${cleanPhone.substring(1)}`;
      }
      const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');
    }

    if (isSupabaseConfigured && supabase) {
      await supabase.from('activity_logs').insert([{
        lead_id: lead.id,
        actor_id: isValidUuid(currentUser?.id) ? currentUser?.id : null,
        action_type: 'whatsapp_sent',
        description: `Sent official document (${doc.document_name}) link to student via WhatsApp`,
        tenant_id: tenantId
      }]);
    } else {
      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        lead_id: lead.id,
        actor_id: currentUser?.id || 'system',
        action_type: 'whatsapp_sent',
        description: `Sent official document (${doc.document_name}) link to student via WhatsApp`,
        created_at: new Date().toISOString()
      };
      const updatedLogs = [log, ...activityLogs];
      setActivityLogs(updatedLogs);
      saveLocal('crm_logs', updatedLogs);
    }
  };

  // Partner Portal & Referrals Integration
  const connectLeadToPartnerStudent = async (leadId: string, studentId: string): Promise<void> => {
    const visaPipe = pipelines.find(p => p.name === 'Visa/Post-Closing Pipeline');
    const visaPipeId = visaPipe?.id || null;
    const initialStage = visaPipe?.stages[0]?.id || 'Doc Collection';

    if (isSupabaseConfigured && supabase) {
      const { error: studentErr } = await supabase
        .from('partner_students')
        .update({ crm_lead_id: leadId, application_status: 'converted', updated_at: new Date().toISOString() })
        .eq('id', studentId);
      if (studentErr) throw studentErr;

      const { error: leadErr } = await supabase
        .from('leads')
        .update({
          pipeline_id: visaPipeId,
          status: initialStage,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId)
        .eq('tenant_id', tenantId);
      if (leadErr) throw leadErr;

      const student = partnerStudents.find(ps => ps.id === studentId);
      const partner = partners.find(p => p.id === student?.partner_id);
      const studentName = student ? `${student.first_name} ${student.last_name}` : 'Referred Student';
      const partnerName = partner?.business_name || 'Partner Agency';

      await supabase.from('activity_logs').insert([{
        lead_id: leadId,
        actor_id: isValidUuid(currentUser?.id) ? currentUser?.id : null,
        action_type: 'assigned',
        description: `Linked to referred student ${studentName} from ${partnerName}. Transitioned to Visa/Post-Closing Pipeline.`,
        tenant_id: tenantId
      }]);
    } else {
      const updatedStudents = partnerStudents.map(ps => {
        if (ps.id === studentId) {
          return { ...ps, crm_lead_id: leadId, application_status: 'converted', updated_at: new Date().toISOString() };
        }
        return ps;
      });
      setPartnerStudents(updatedStudents);
      saveLocal('crm_partner_students', updatedStudents);

      const updatedLeads = leads.map(l => {
        if (l.id === leadId) {
          return {
            ...l,
            pipeline_id: visaPipeId,
            status: initialStage,
            updated_at: new Date().toISOString()
          };
        }
        return l;
      });
      setLeads(updatedLeads);
      saveLocal('crm_leads', updatedLeads);

      const student = partnerStudents.find(ps => ps.id === studentId);
      const partner = partners.find(p => p.id === student?.partner_id);
      const studentName = student ? `${student.first_name} ${student.last_name}` : 'Referred Student';
      const partnerName = partner?.business_name || 'Partner Agency';

      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        lead_id: leadId,
        actor_id: currentUser?.id || 'system',
        action_type: 'assigned',
        description: `Linked to referred student ${studentName} from ${partnerName}. Transitioned to Visa/Post-Closing Pipeline.`,
        created_at: new Date().toISOString()
      };
      const updatedLogs = [log, ...activityLogs];
      setActivityLogs(updatedLogs);
      saveLocal('crm_logs', updatedLogs);
    }
  };

  const disconnectLeadFromPartnerStudent = async (studentId: string): Promise<void> => {
    const student = partnerStudents.find(ps => ps.id === studentId);
    const leadId = student?.crm_lead_id;

    if (isSupabaseConfigured && supabase) {
      const { error: studentErr } = await supabase
        .from('partner_students')
        .update({ crm_lead_id: null, application_status: 'referred', updated_at: new Date().toISOString() })
        .eq('id', studentId);
      if (studentErr) throw studentErr;

      if (leadId) {
        const studentName = student ? `${student.first_name} ${student.last_name}` : 'Referred Student';
        await supabase.from('activity_logs').insert([{
          lead_id: leadId,
          actor_id: isValidUuid(currentUser?.id) ? currentUser?.id : null,
          action_type: 'assigned',
          description: `Unlinked from referred student ${studentName}`,
          tenant_id: tenantId
        }]);
      }
    } else {
      const updatedStudents = partnerStudents.map(ps => {
        if (ps.id === studentId) {
          return { ...ps, crm_lead_id: null, application_status: 'referred', updated_at: new Date().toISOString() };
        }
        return ps;
      });
      setPartnerStudents(updatedStudents);
      saveLocal('crm_partner_students', updatedStudents);

      if (leadId) {
        const studentName = student ? `${student.first_name} ${student.last_name}` : 'Referred Student';
        const log: ActivityLog = {
          id: `log-${Date.now()}`,
          lead_id: leadId,
          actor_id: currentUser?.id || 'system',
          action_type: 'assigned',
          description: `Unlinked from referred student ${studentName}`,
          created_at: new Date().toISOString()
        };
        const updatedLogs = [log, ...activityLogs];
        setActivityLogs(updatedLogs);
        saveLocal('crm_logs', updatedLogs);
      }
    }
  };

  const verifyPartnerDoc = async (docId: string, status: 'verified' | 'rejected'): Promise<void> => {
    const doc = partnerUploadedDocs.find(d => d.id === docId);
    if (!doc) throw new Error("Document not found");

    const student = partnerStudents.find(ps => ps.id === doc.student_id);
    const leadId = student?.crm_lead_id;

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('partner_uploaded_docs')
        .update({ verification_status: status, updated_at: new Date().toISOString() })
        .eq('id', docId);
      if (error) throw error;

      // Update state so the UI updates immediately
      setPartnerUploadedDocs(prev => prev.map(d => {
        if (d.id === docId) {
          return { ...d, verification_status: status, updated_at: new Date().toISOString() };
        }
        return d;
      }));

      if (leadId) {
        await supabase.from('activity_logs').insert([{
          lead_id: leadId,
          actor_id: isValidUuid(currentUser?.id) ? currentUser?.id : null,
          action_type: 'status_change',
          description: `Partner document '${doc.document_name}' has been ${status}`,
          tenant_id: tenantId
        }]);
      }

      // Trigger background push notification to consultant
      (async () => {
        try {
          const { data: docData } = await supabase
            .from('partner_uploaded_docs')
            .select('document_name, student_id')
            .eq('id', docId)
            .single();

          if (docData?.student_id) {
            const { data: studentData } = await supabase
              .from('partner_students')
              .select('first_name, last_name, submitted_by')
              .eq('id', docData.student_id)
              .single();

            if (studentData?.submitted_by) {
              const { data: userData } = await supabase
                .from('partner_users')
                .select('push_token')
                .eq('id', studentData.submitted_by)
                .single();

              if (userData?.push_token && (userData.push_token.startsWith('ExponentPushToken') || userData.push_token.startsWith('ExpoPushToken'))) {
                const studentName = `${studentData.first_name} ${studentData.last_name}`;
                const title = status === 'verified' ? 'Document Approved' : 'Document Rejected';
                const body = status === 'verified'
                  ? `Great news! The document "${docData.document_name}" for ${studentName} has been approved.`
                  : `Attention: The document "${docData.document_name}" for ${studentName} was rejected. Please review and re-upload.`;

                await fetch('https://exp.host/--/api/v2/push/send', {
                  method: 'POST',
                  headers: {
                    'Accept': 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    to: userData.push_token,
                    title,
                    body,
                    sound: 'default',
                    data: { link: `student:${docData.student_id}`, studentId: docData.student_id, documentName: docData.document_name }
                  })
                });
                console.log(`[Push Notification] Dispatched successfully to consultant ${studentData.submitted_by} for student ${studentName}`);
              }
            }
          }
        } catch (pushErr: any) {
          console.error("Error triggering push notification for document verification:", pushErr);
        }
      })();
    } else {
      const updated = partnerUploadedDocs.map(d => {
        if (d.id === docId) {
          return { ...d, verification_status: status, updated_at: new Date().toISOString() };
        }
        return d;
      });
      setPartnerUploadedDocs(updated);
      saveLocal('crm_partner_uploaded_docs', updated);

      if (leadId) {
        const log: ActivityLog = {
          id: `log-${Date.now()}`,
          lead_id: leadId,
          actor_id: currentUser?.id || 'system',
          action_type: 'status_change',
          description: `Partner document '${doc.document_name}' has been ${status}`,
          created_at: new Date().toISOString()
        };
        const updatedLogs = [log, ...activityLogs];
        setActivityLogs(updatedLogs);
        saveLocal('crm_logs', updatedLogs);
      }
    }
  };

  const uploadAdminPartnerDoc = async (studentId: string, documentName: string, file: File): Promise<void> => {
    let fileUrl = '';
    let fileName = file.name;

    if (isSupabaseConfigured && supabase) {
      const bucketName = 'partner_student_documents';
      const fileKey = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      
      let { data, error } = await supabase.storage.from(bucketName).upload(fileKey, file, {
        cacheControl: '3600',
        upsert: false
      });
      
      if (error) {
        try {
          await supabase.storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 10485760 // 10MB
          });
          
          const retryResult = await supabase.storage.from(bucketName).upload(fileKey, file, {
            cacheControl: '3600',
            upsert: false
          });
          if (retryResult.error) throw retryResult.error;
          data = retryResult.data;
        } catch (bucketErr: any) {
          throw new Error(error.message || "Failed to upload file to storage.");
        }
      }
      
      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(fileKey);
      fileUrl = urlData.publicUrl;
    } else {
      fileUrl = `https://mockstorage.com/partner_documents/${Date.now()}_${file.name}`;
    }

    if (isSupabaseConfigured && supabase) {
      const { data: newDoc, error } = await supabase
        .from('partner_uploaded_docs')
        .upsert({
          student_id: studentId,
          document_name: documentName,
          file_url: fileUrl,
          file_name: fileName,
          verification_status: 'verified',
          uploaded_by_admin: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'student_id,document_name'
        })
        .select()
        .single();
        
      if (error) throw error;

      if (newDoc) {
        setPartnerUploadedDocs(prev => {
          const filtered = prev.filter(d => !(d.student_id === studentId && d.document_name.toLowerCase() === documentName.toLowerCase()));
          return [...filtered, newDoc];
        });

        // Trigger in-app and push notifications for the partner portal
        (async () => {
          try {
            const { data: student } = await supabase
              .from('partner_students')
              .select('first_name, last_name, partner_id')
              .eq('id', studentId)
              .single();

            if (student) {
              const studentName = `${student.first_name} ${student.last_name}`;

              // 1. Insert in-app notification entry
              await supabase
                .from('partner_announcements')
                .insert([{
                  title: '📄 New Document Issued',
                  content: `CRM admin uploaded "${documentName}" for student ${studentName}.`,
                  priority: 'normal',
                  target_partner_id: student.partner_id,
                  type: 'notification'
                }]);

              // 2. Fetch partner users and send push notifications via Expo API
              const { data: partnerUsers } = await supabase
                .from('partner_users')
                .select('push_token')
                .eq('partner_id', student.partner_id)
                .not('push_token', 'is', null);

              if (partnerUsers && partnerUsers.length > 0) {
                const tokens = partnerUsers
                  .map((u: any) => u.push_token)
                  .filter((t: any) => typeof t === 'string' && (t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken')));

                if (tokens.length > 0) {
                  const pushMessages = tokens.map(token => ({
                    to: token,
                    sound: 'default',
                    title: '📄 New Document Issued',
                    body: `CRM admin uploaded "${documentName}" for student ${studentName}.`,
                    data: { link: `student:${studentId}`, studentId }
                  }));

                  await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(pushMessages)
                  });
                  console.log(`[Push] Dispatched document upload push notification to partner users of agency ${student.partner_id}`);
                }
              }
            }
          } catch (notifErr) {
            console.warn('[Upload Notification] Failed to send notifications:', notifErr);
          }
        })();
      }
    } else {
      const mockDoc = {
        id: `admin-doc-${Date.now()}`,
        student_id: studentId,
        document_name: documentName,
        file_url: fileUrl,
        file_name: fileName,
        verification_status: 'verified',
        uploaded_by_admin: true,
        uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const updated = [...partnerUploadedDocs.filter(d => !(d.student_id === studentId && d.document_name.toLowerCase() === documentName.toLowerCase())), mockDoc];
      setPartnerUploadedDocs(updated);
      saveLocal('crm_partner_uploaded_docs', updated);
    }
  };

  const addRedirectLink = async (slug: string, title: string, destinationUrl: string): Promise<RedirectLink> => {
    const cleanSlug = slug.trim().toLowerCase().replace(/\s+/g, '-');
    const newLink: RedirectLink = {
      id: `link-${Date.now()}`,
      slug: cleanSlug,
      title,
      destination_url: destinationUrl,
      clicks: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tenant_id: tenantId
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('redirect_links')
        .insert([{
          slug: cleanSlug,
          title,
          destination_url: destinationUrl,
          tenant_id: tenantId
        }])
        .select()
        .single();
      if (error) {
        if (error.code === '23505') throw new Error(`Slug '${cleanSlug}' is already in use.`);
        throw error;
      }
      if (data) {
        setRedirectLinks(prev => [data as RedirectLink, ...prev]);
      }
      return data as RedirectLink;
    } else {
      if (redirectLinks.some(l => l.slug === cleanSlug)) {
        throw new Error(`Slug '${cleanSlug}' is already in use.`);
      }
      const updated = [newLink, ...redirectLinks];
      setRedirectLinks(updated);
      saveLocal('crm_redirect_links', updated);
      return newLink;
    }
  };

  const updateRedirectLink = async (id: string, updates: Partial<RedirectLink>): Promise<RedirectLink> => {
    if (updates.slug) {
      updates.slug = updates.slug.trim().toLowerCase().replace(/\s+/g, '-');
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('redirect_links')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();
      if (error) {
        if (error.code === '23505') throw new Error(`Slug is already in use.`);
        throw error;
      }
      if (data) {
        setRedirectLinks(prev => prev.map(l => l.id === id ? (data as RedirectLink) : l));
      }
      return data as RedirectLink;
    } else {
      const link = redirectLinks.find(l => l.id === id);
      if (!link) throw new Error("Link not found");
      
      if (updates.slug && redirectLinks.some(l => l.id !== id && l.slug === updates.slug)) {
        throw new Error(`Slug '${updates.slug}' is already in use.`);
      }

      const updatedLink = {
        ...link,
        ...updates,
        updated_at: new Date().toISOString()
      };
      const updated = redirectLinks.map(l => l.id === id ? updatedLink : l);
      setRedirectLinks(updated);
      saveLocal('crm_redirect_links', updated);
      return updatedLink;
    }
  };

  const deleteRedirectLink = async (id: string): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('redirect_links')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);
      if (error) throw error;
      setRedirectLinks(prev => prev.filter(l => l.id !== id));
    } else {
      const updated = redirectLinks.filter(l => l.id !== id);
      setRedirectLinks(updated);
      saveLocal('crm_redirect_links', updated);
    }
  };

  const syncPartnerReferrals = async (): Promise<{ importedCount: number }> => {
    // ── Admin-configured routing rules ─────────────────────────────────────────
    // Admin sets these in CRM Settings > Partner Lead Auto-Routing.
    // If a rule is disabled or unconfigured, fall back to the default pipeline/stage.
    const routingInterested = settings.partner_routing_interested;
    const routingConfirmed = settings.partner_routing_confirmed;

    // Default fallback pipelines (used when admin hasn't configured routing rules)
    const visaPipe = pipelines.find(p => p.name === 'Visa/Post-Closing Pipeline');
    const salesPipe = pipelines.find(p => p.is_default) || pipelines[0];

    const getRoutingForStudent = (student: any): { pipelineId: string | null; stage: string } => {
      const isConfirmed = (student.referral_type || 'interested') === 'confirmed';
      const rule = isConfirmed ? routingConfirmed : routingInterested;

      if (rule && rule.enabled && rule.pipeline_id && rule.stage_id) {
        // Apply country filter (if configured)
        if (rule.filter_countries.length > 0 &&
            !rule.filter_countries.some(c => c.toLowerCase() === (student.destination_country || '').toLowerCase())) {
          return { pipelineId: null, stage: '' }; // skip — doesn't match filter
        }
        // Apply course filter (if configured)
        if (rule.filter_courses.length > 0 &&
            !rule.filter_courses.some(c => c.toLowerCase() === (student.target_program || '').toLowerCase())) {
          return { pipelineId: null, stage: '' }; // skip — doesn't match filter
        }
        // Find the pipeline to verify stage exists
        const targetPipeline = pipelines.find(p => p.id === rule.pipeline_id);
        const stageExists = targetPipeline?.stages.some(s => s.id === rule.stage_id);
        return {
          pipelineId: rule.pipeline_id,
          stage: stageExists ? rule.stage_id : (targetPipeline?.stages[0]?.id || rule.stage_id)
        };
      }

      // Default behaviour (no rule configured)
      if (isConfirmed) {
        return { pipelineId: visaPipe?.id || salesPipe?.id || null, stage: visaPipe?.stages[0]?.id || 'Doc Collection' };
      } else {
        return { pipelineId: salesPipe?.id || null, stage: salesPipe?.stages[0]?.id || '1st followup' };
      }
    };
    // ── End routing resolution ──────────────────────────────────────────────────

    // 1. Find all partner students where crm_lead_id is null
    const unconnectedStudents = partnerStudents.filter(ps => !ps.crm_lead_id);
    if (unconnectedStudents.length === 0) {
      return { importedCount: 0 };
    }

    let importedCount = 0;

    if (isSupabaseConfigured && supabase) {
      for (const student of unconnectedStudents) {
        const partner = partners.find(p => p.id === student.partner_id);
        const partnerName = partner?.business_name || 'Partner Agency';

        const { pipelineId: targetPipeId, stage: targetStage } = getRoutingForStudent(student);
        // Skip student if routing filter doesn't match
        if (!targetPipeId || !targetStage) continue;

        const isConfirmed = (student.referral_type || 'interested') === 'confirmed';
        const targetPipeline = pipelines.find(p => p.id === targetPipeId);
        // Resolve staff member name if available
        let staffName = 'Partner Staff';
        if (student.submitted_by) {
          try {
            const { data: staffObj } = await supabase
              .from('partner_users')
              .select('full_name')
              .eq('id', student.submitted_by)
              .maybeSingle();
            if (staffObj && staffObj.full_name) {
              staffName = staffObj.full_name;
            }
          } catch (err) {
            console.warn("Could not fetch staff name:", err);
          }
        }

        // 1. Insert new lead
        const { data: newLead, error: leadErr } = await supabase
          .from('leads')
          .insert([{
            name: `${student.first_name} ${student.last_name}`,
            phone: student.phone,
            email: student.email || null,
            preferred_destination: student.destination_country,
            course: student.target_program,
            lead_source: partnerName,
            external_consultant: staffName,
            status: targetStage,
            pipeline_id: targetPipeId,
            tenant_id: tenantId
          }])
          .select()
          .single();

        if (leadErr) {
          console.error("Error creating lead from partner student:", leadErr);
          continue;
        }

        if (newLead) {
          // 2. Update partner_student reference
          const { error: studentErr } = await supabase
            .from('partner_students')
            .update({ 
              crm_lead_id: newLead.id, 
              application_status: isConfirmed ? 'converted' : 'referred', 
              updated_at: new Date().toISOString() 
            })
            .eq('id', student.id);

          if (studentErr) {
            console.error("Error updating partner student reference:", studentErr);
            continue;
          }

          // 3. Create activity log
          await supabase.from('activity_logs').insert([{
            lead_id: newLead.id,
            actor_id: isValidUuid(currentUser?.id) ? currentUser?.id : null,
            action_type: 'assigned',
            description: `Imported from Partner Portal referral by ${partnerName} → ${targetPipeline?.name || 'Pipeline'} / ${targetStage}.`,
            tenant_id: tenantId
          }]);

          // Send email notification to admin about the manually synced student referral
          try {
            const emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1a202c;">
                <div style="text-align: center; margin-bottom: 25px;">
                  <h2 style="color: #4f46e5; margin: 0; font-size: 24px; font-weight: 800;">Perfect Scholar CRM</h2>
                  <span style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #a0aec0; letter-spacing: 1.5px; display: block; margin-top: 5px;">New Referral Synced</span>
                </div>
                <p style="font-size: 15px; line-height: 1.6; color: #4a5568;">Hello Admin, a new referred candidate has been synced to the CRM pipelines:</p>
                <div style="background-color: #f7fafc; padding: 20px; border-radius: 12px; margin: 25px 0; border: 1px dashed #e2e8f0;">
                  <table style="width: 100%; font-size: 14px; line-height: 1.5;">
                    <tr>
                      <td style="font-weight: bold; color: #718096; padding: 8px 0; width: 150px;">Candidate Name</td>
                      <td style="color: #2d3748; padding: 8px 0; font-weight: bold;">${student.first_name} ${student.last_name}</td>
                    </tr>
                    <tr>
                      <td style="font-weight: bold; color: #718096; padding: 8px 0;">Contact Phone</td>
                      <td style="color: #2d3748; padding: 8px 0;">${student.phone}</td>
                    </tr>
                    <tr>
                      <td style="font-weight: bold; color: #718096; padding: 8px 0;">Destination</td>
                      <td style="color: #2d3748; padding: 8px 0;">${student.destination_country || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td style="font-weight: bold; color: #718096; padding: 8px 0;">University</td>
                      <td style="color: #2d3748; padding: 8px 0;">${student.target_university || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td style="font-weight: bold; color: #718096; padding: 8px 0;">Lead Source</td>
                      <td style="color: #4f46e5; padding: 8px 0; font-weight: bold;">Partner: ${partnerName}</td>
                    </tr>
                  </table>
                </div>
              </div>
            `;

            const adminEmails = ['nash@pixwik.com', 'crm@perfectscholar.com'];
            for (const adminEmail of adminEmails) {
              fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: adminEmail,
                  subject: `🔥 New Partner Referral Synced: ${student.first_name} ${student.last_name}`,
                  html: emailHtml
                })
              }).catch(e => console.error("Error triggering sync email:", e));
            }
          } catch (syncMailErr) {
            console.error("Error formatting sync email:", syncMailErr);
          }

          importedCount++;
        }
      }

      // Re-fetch data if any imported to update the UI
      if (importedCount > 0) {
        const { data: leadsList } = await supabase.from('leads').select('*').eq('tenant_id', tenantId);
        if (leadsList) setLeads(leadsList);
        
        const { data: partStudentsList } = await supabase.from('partner_students').select('*');
        if (partStudentsList) setPartnerStudents(partStudentsList);
      }

    } else {
      // Local Mock Mode
      const updatedLeads = [...leads];
      const updatedStudents = partnerStudents.map(ps => {
        const matching = unconnectedStudents.find(us => us.id === ps.id);
        if (matching) {
          const partner = partners.find(p => p.id === matching.partner_id);
          const partnerName = partner?.business_name || 'Partner Agency';
          const { pipelineId: targetPipeId, stage: targetStage } = getRoutingForStudent(matching);
          // Skip if routing filter doesn't match
          if (!targetPipeId || !targetStage) return ps;
          const isConfirmed = (matching.referral_type || 'interested') === 'confirmed';
          const targetPipeline = pipelines.find(p => p.id === targetPipeId);

          const mockLeadId = `lead-${Date.now()}-${importedCount}`;
          const newLead: Lead = {
            id: mockLeadId,
            name: `${matching.first_name} ${matching.last_name}`,
            phone: matching.phone,
            email: matching.email || undefined,
            preferred_destination: matching.destination_country,
            course: matching.target_program,
            lead_source: `Partner: ${partnerName}`,
            status: targetStage,
            pipeline_id: targetPipeId || undefined,
            score: 75,
            tags: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          updatedLeads.push(newLead);

          const log: ActivityLog = {
            id: `log-${Date.now()}-${importedCount}`,
            lead_id: mockLeadId,
            actor_id: currentUser?.id || 'system',
            action_type: 'assigned',
            description: `Imported from Partner Portal referral by ${partnerName} → ${targetPipeline?.name || 'Pipeline'} / ${targetStage}.`,
            created_at: new Date().toISOString()
          };
          activityLogs.unshift(log);

          importedCount++;
          return {
            ...ps,
            crm_lead_id: mockLeadId,
            application_status: isConfirmed ? 'converted' : 'referred',
            updated_at: new Date().toISOString()
          };
        }
        return ps;
      });

      if (importedCount > 0) {
        setLeads(updatedLeads);
        saveLocal('crm_leads', updatedLeads);

        setPartnerStudents(updatedStudents);
        saveLocal('crm_partner_students', updatedStudents);

        setActivityLogs([...activityLogs]);
        saveLocal('crm_logs', activityLogs);
      }
    }

    return { importedCount };
  };

  // Pipeline CRUD Functions
  const addPipeline = async (name: string, stages: PipelineStage[]): Promise<Pipeline> => {
    const newPipeItem: Omit<Pipeline, 'id' | 'created_at' | 'updated_at'> = {
      name,
      stages,
      tenant_id: tenantId,
      is_default: false
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('pipelines')
        .insert([newPipeItem])
        .select()
        .single();
      if (error) throw error;
      
      // Auto-grant access to creator/admin
      if (currentUser?.id && isValidUuid(currentUser.id)) {
        await supabase.from('pipeline_access').insert([{
          pipeline_id: data.id,
          profile_id: currentUser.id,
          tenant_id: tenantId
        }]);
      }
      return data as Pipeline;
    } else {
      const mockPipe: Pipeline = {
        ...newPipeItem,
        id: `pipeline-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const updated = [...pipelines, mockPipe];
      setPipelines(updated);
      saveLocal('crm_pipelines', updated);

      // Grant access to all profiles initially in mock mode
      const mockAccess = profiles.map(p => ({
        id: `pa-${mockPipe.id}-${p.id}`,
        pipeline_id: mockPipe.id,
        profile_id: p.id,
        tenant_id: tenantId,
        created_at: new Date().toISOString()
      }));
      const updatedAccess = [...pipelineAccess, ...mockAccess];
      setPipelineAccess(updatedAccess);
      saveLocal('crm_pipeline_access', updatedAccess);

      return mockPipe;
    }
  };

  const updatePipeline = async (id: string, name: string, stages: PipelineStage[]): Promise<Pipeline> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('pipelines')
        .update({ name, stages, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();
      if (error) throw error;
      return data as Pipeline;
    } else {
      const updated = pipelines.map(p => {
        if (p.id === id) {
          return {
            ...p,
            name,
            stages,
            updated_at: new Date().toISOString()
          };
        }
        return p;
      });
      setPipelines(updated);
      saveLocal('crm_pipelines', updated);

      const updatedPipe = updated.find(p => p.id === id);
      if (!updatedPipe) throw new Error("Pipeline not found");
      return updatedPipe;
    }
  };

  const deletePipeline = async (id: string): Promise<void> => {
    // Check if there are any leads using this pipeline
    const leadsInPipeline = leads.filter(l => l.pipeline_id === id);
    if (leadsInPipeline.length > 0) {
      throw new Error(`Cannot delete pipeline: there are ${leadsInPipeline.length} active leads associated with it.`);
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('pipelines')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);
      if (error) throw error;
      setPipelines(prev => prev.filter(p => p.id !== id));
      setPipelineAccess(prev => prev.filter(pa => pa.pipeline_id !== id));
    } else {
      const updated = pipelines.filter(p => p.id !== id);
      setPipelines(updated);
      saveLocal('crm_pipelines', updated);

      const updatedAccess = pipelineAccess.filter(pa => pa.pipeline_id !== id);
      setPipelineAccess(updatedAccess);
      saveLocal('crm_pipeline_access', updatedAccess);
    }

    if (activePipeline?.id === id) {
      const remaining = pipelines.filter(p => p.id !== id);
      const fallback = remaining.find(p => p.is_default) || remaining[0] || null;
      setActivePipeline(fallback);
    }
  };

  const updatePipelineAccess = async (pipelineId: string, allowedProfileIds: string[]): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      // Delete existing access records for this pipeline
      const { error: deleteError } = await supabase
        .from('pipeline_access')
        .delete()
        .eq('pipeline_id', pipelineId)
        .eq('tenant_id', tenantId);
      if (deleteError) throw deleteError;

      // Insert new access records
      if (allowedProfileIds.length > 0) {
        const rows = allowedProfileIds.map(profileId => ({
          pipeline_id: pipelineId,
          profile_id: profileId,
          tenant_id: tenantId
        }));
        const { error: insertError } = await supabase
          .from('pipeline_access')
          .insert(rows);
        if (insertError) throw insertError;
      }
      
      // Fetch fresh access list from DB to synchronize local state
      const { data: freshList } = await supabase
        .from('pipeline_access')
        .select('*')
        .eq('tenant_id', tenantId);
      if (freshList) {
        setPipelineAccess(freshList as PipelineAccess[]);
      }
    } else {
      // Local fallback
      const filteredAccess = pipelineAccess.filter(pa => pa.pipeline_id !== pipelineId);
      const newAccessRows = allowedProfileIds.map(profileId => ({
        id: `pa-${pipelineId}-${profileId}-${Date.now()}`,
        pipeline_id: pipelineId,
        profile_id: profileId,
        tenant_id: tenantId,
        created_at: new Date().toISOString()
      }));
      const updated = [...filteredAccess, ...newAccessRows];
      setPipelineAccess(updated);
      saveLocal('crm_pipeline_access', updated);
    }
  };

  // Periodically request notification permissions
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <DataContext.Provider value={{
      isConfigured: isSupabaseConfigured,
      currentUser,
      setCurrentUser,
      newLeadAlert,
      setNewLeadAlert,
      profiles,
      leads,
      notes,
      tasks,
      activityLogs,
      whatsappHistory,
      whatsappTemplates,
      settings,
      login,
      logout,
      switchUser,
      updateProfileRole,
      createUserProfile,
      deleteUserProfile,
      resetUserProfilePassword,
      updateSettings,
      addLead,
      updateLead,
      deleteLead,
      deleteLeads,
      bulkAddLeads,
      addNote,
      addTask,
      toggleTask,
      sendWhatsAppTemplate,
      sendCustomWhatsApp,
      addWhatsAppTemplate,
      updateWhatsAppTemplate,
      deleteWhatsAppTemplate,
      uploadAttachment,
      
      // Pipelines Operations
      pipelines,
      pipelineAccess,
      activePipeline,
      setActivePipeline,
      addPipeline,
      updatePipeline,
      deletePipeline,
      updatePipelineAccess,

      // Visa Operations
      visaApplications,
      visaRequiredDocs,
      visaUploadedDocs,
      updateVisaApplication,
      saveVisaRequiredDoc,
      deleteVisaRequiredDoc,
      uploadVisaDoc,
      deleteVisaDoc,
      verifyVisaDoc,
      sendVisaDocToStudent,
      
      // Partner Portal Integration
      partners,
      partnerStudents,
      partnerUploadedDocs,
      connectLeadToPartnerStudent,
      disconnectLeadFromPartnerStudent,
      verifyPartnerDoc,
      uploadAdminPartnerDoc,
      syncPartnerReferrals,
      colleges,
      redirectLinks,
      addRedirectLink,
      updateRedirectLink,
      deleteRedirectLink,
      
      triggerLeadSimulation,
      isLoading,
      tenantId,
      isSubscriptionValid
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
};
