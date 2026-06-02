"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Profile, Lead, Note, Task, ActivityLog, WhatsAppMessage, WhatsAppTemplate, CRMSettings, PipelineStage, UserRole } from '@/types/crm';

interface DataContextType {
  isConfigured: boolean;
  currentUser: Profile | null;
  setCurrentUser: (profile: Profile | null) => void;
  profiles: Profile[];
  leads: Lead[];
  notes: Note[];
  tasks: Task[];
  activityLogs: ActivityLog[];
  whatsappHistory: WhatsAppMessage[];
  whatsappTemplates: WhatsAppTemplate[];
  settings: CRMSettings;
  
  // Auth/User Operations
  login: (email: string, role: UserRole, name: string, password?: string) => Promise<Profile>;
  logout: () => void;
  switchUser: (profile: Profile) => void;
  updateProfileRole: (profileId: string, role: UserRole) => Promise<void>;
  createUserProfile: (email: string, role: UserRole, name: string, phone?: string, password?: string) => Promise<Profile>;
  updateSettings: (newSettings: Partial<CRMSettings>) => void;


  // Lead Operations
  addLead: (lead: Omit<Lead, 'id' | 'created_at' | 'updated_at'>) => Promise<Lead>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<Lead>;
  deleteLead: (id: string) => Promise<void>;
  
  // Notes Operations
  addNote: (leadId: string, content: string) => Promise<Note>;
  
  // Tasks Operations
  addTask: (leadId: string, title: string, dueDate?: string) => Promise<Task>;
  toggleTask: (taskId: string) => Promise<Task>;
  
  // WhatsApp Operations
  sendWhatsAppTemplate: (leadId: string, templateId: string) => Promise<void>;
  sendCustomWhatsApp: (leadId: string, message: string) => Promise<void>;
  
  // Simulation Helpers
  triggerLeadSimulation: () => void;
  isLoading: boolean;
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
  }
];

const MOCK_PROFILES: Profile[] = [
  { id: 'user-admin', full_name: 'Nash Newton (Admin)', role: 'admin', created_at: new Date().toISOString(), phone: '+919876543212' },
  { id: 'user-manager', full_name: 'Rajesh Kumar (Manager)', role: 'manager', created_at: new Date().toISOString(), phone: '+919876543213' },
  { id: 'user-counsellor-1', full_name: 'Amit Verma', role: 'counsellor', created_at: new Date().toISOString(), phone: '+919876543210' },
  { id: 'user-counsellor-2', full_name: 'Priya Sharma', role: 'counsellor', created_at: new Date().toISOString(), phone: '+919876543211' }
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

const DEFAULT_SETTINGS: CRMSettings = {
  company_name: 'Perfect Scholar Lead Management',
  admission_year_prefix: '2026',
  lead_assignment_rule: 'round-robin',
  routing_budget_threshold: 40,
  meta_verify_token: 'edupath_crm_verify_token_xyz',
  meta_access_token: 'EAAG...placeholder...token',
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
  const [isLoading, setIsLoading] = useState(true);

  // Initialize DB or Local Storage
  useEffect(() => {
    let leadsChannel: any = null;
    const client = supabase;

    const initData = async () => {
      setIsLoading(true);
      if (isSupabaseConfigured && client) {
        try {
          // Fetch active user profile
          const { data: { session } } = await client.auth.getSession();
          if (session?.user) {
            const { data: profile } = await client
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            if (profile) setCurrentUser(profile as Profile);
          }

          // Load other entities
          const { data: pList } = await client.from('profiles').select('*');
          if (pList) setProfiles(pList as Profile[]);

          const { data: lList } = await client.from('leads').select('*').order('created_at', { ascending: false });
          if (lList) setLeads(lList as Lead[]);

          const { data: nList } = await client.from('notes').select('*').order('created_at', { ascending: false });
          if (nList) setNotes(nList as Note[]);

          const { data: tList } = await client.from('tasks').select('*').order('created_at', { ascending: false });
          if (tList) setTasks(tList as Task[]);

          const { data: aList } = await client.from('activity_logs').select('*').order('created_at', { ascending: false });
          if (aList) setActivityLogs(aList as ActivityLog[]);

          const { data: wHist } = await client.from('whatsapp_history').select('*').order('created_at', { ascending: false });
          if (wHist) setWhatsappHistory(wHist as WhatsAppMessage[]);

          const { data: wTemp } = await client.from('whatsapp_templates').select('*');
          if (wTemp && wTemp.length > 0) setWhatsappTemplates(wTemp as WhatsAppTemplate[]);

          // Set up real-time listener subscriptions
          leadsChannel = client.channel('realtime-db-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
              if (payload.eventType === 'INSERT') {
                setLeads(prev => [payload.new as Lead, ...prev]);
              } else if (payload.eventType === 'UPDATE') {
                setLeads(prev => prev.map(l => l.id === payload.new.id ? (payload.new as Lead) : l));
              } else if (payload.eventType === 'DELETE') {
                setLeads(prev => prev.filter(l => l.id !== payload.old.id));
              }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, (payload) => {
              if (payload.eventType === 'INSERT') setNotes(prev => [payload.new as Note, ...prev]);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
              if (payload.eventType === 'INSERT') {
                setTasks(prev => [payload.new as Task, ...prev]);
              } else if (payload.eventType === 'UPDATE') {
                setTasks(prev => prev.map(t => t.id === payload.new.id ? (payload.new as Task) : t));
              }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_history' }, (payload) => {
              if (payload.eventType === 'INSERT') setWhatsappHistory(prev => [payload.new as WhatsAppMessage, ...prev]);
            })
            .subscribe();
        } catch (error) {
          console.error("Supabase load error: ", error);
        }
      } else {
        // LocalStorage fallback mock load
        const storedUser = localStorage.getItem('crm_user');
        const storedProfiles = localStorage.getItem('crm_profiles');
        const storedLeads = localStorage.getItem('crm_leads');
        const storedNotes = localStorage.getItem('crm_notes');
        const storedTasks = localStorage.getItem('crm_tasks');
        const storedLogs = localStorage.getItem('crm_logs');
        const storedWHist = localStorage.getItem('crm_whist');
        const storedSettings = localStorage.getItem('crm_settings');

        let parsedUser = storedUser ? JSON.parse(storedUser) : null;
        let parsedProfiles = storedProfiles ? JSON.parse(storedProfiles) : MOCK_PROFILES;
        let parsedLeads = storedLeads ? JSON.parse(storedLeads) : MOCK_LEADS;
        let parsedNotes = storedNotes ? JSON.parse(storedNotes) : [];
        let parsedTasks = storedTasks ? JSON.parse(storedTasks) : [];
        let parsedLogs = storedLogs ? JSON.parse(storedLogs) : [];
        let parsedWHist = storedWHist ? JSON.parse(storedWHist) : [];
        let parsedSettings = storedSettings ? JSON.parse(storedSettings) : DEFAULT_SETTINGS;

        // Auto-migration: if local storage has stale/legacy pipeline stages, reset to the new default stages
        const hasLegacyStages = parsedSettings.pipeline_stages?.some(
          (s: any) => s.id === 'New Lead' || s.id === 'Qualified' || s.id === 'WhatsApp Initiated'
        );

        if (hasLegacyStages) {
          parsedSettings = DEFAULT_SETTINGS;
          parsedLeads = MOCK_LEADS;
          parsedNotes = [];
          parsedTasks = [];
          parsedLogs = [];
          parsedWHist = [];
          
          localStorage.setItem('crm_settings', JSON.stringify(DEFAULT_SETTINGS));
          localStorage.setItem('crm_leads', JSON.stringify(MOCK_LEADS));
          localStorage.removeItem('crm_notes');
          localStorage.removeItem('crm_tasks');
          localStorage.removeItem('crm_logs');
          localStorage.removeItem('crm_whist');
        }

        if (parsedUser) setCurrentUser(parsedUser);
        else setCurrentUser(MOCK_PROFILES[0]); // Auto-login as admin initially

        setProfiles(parsedProfiles);
        setLeads(parsedLeads);
        setNotes(parsedNotes);
        setTasks(parsedTasks);
        setActivityLogs(parsedLogs);
        setWhatsappHistory(parsedWHist);
        setWhatsappTemplates(DEFAULT_TEMPLATES);
        setSettings(parsedSettings);
        
        // Populate default arrays if empty initially
        if (!storedProfiles) localStorage.setItem('crm_profiles', JSON.stringify(MOCK_PROFILES));
        if (!storedLeads && !hasLegacyStages) localStorage.setItem('crm_leads', JSON.stringify(MOCK_LEADS));
        if (!storedSettings && !hasLegacyStages) localStorage.setItem('crm_settings', JSON.stringify(DEFAULT_SETTINGS));
      }
      setIsLoading(false);
    };

    initData();

    return () => {
      if (isSupabaseConfigured && client && leadsChannel) {
        client.removeChannel(leadsChannel);
      }
    };
  }, []);

  // Persistent writing for offline localStorage mode
  const saveLocal = (key: string, data: any) => {
    if (!isSupabaseConfigured) {
      localStorage.setItem(key, JSON.stringify(data));
    }
  };

  // Auth Operations
  const login = async (email: string, role: UserRole, name: string, password?: string): Promise<Profile> => {
    if (isSupabaseConfigured && supabase) {
      // In a real environment, we'd sign in through Supabase. For the demo dashboard, 
      // if credentials aren't completed, we authenticate.
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: password || 'password123' });
      if (error) throw error;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user?.id)
        .single();
      
      const prof = profile as Profile;
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
          created_at: new Date().toISOString()
        };
        const updated = [...profiles, matched];
        setProfiles(updated);
        saveLocal('crm_profiles', updated);
      }
      setCurrentUser(matched);
      localStorage.setItem('crm_user', JSON.stringify(matched));
      return matched;
    }
  };

  const logout = () => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut();
    }
    setCurrentUser(null);
    localStorage.removeItem('crm_user');
  };

  const switchUser = (profile: Profile) => {
    setCurrentUser(profile);
    localStorage.setItem('crm_user', JSON.stringify(profile));
  };

  const updateProfileRole = async (profileId: string, role: UserRole) => {
    const updated = profiles.map(p => p.id === profileId ? { ...p, role } : p);
    setProfiles(updated);
    saveLocal('crm_profiles', updated);

    if (currentUser && currentUser.id === profileId) {
      const updatedUser = { ...currentUser, role };
      setCurrentUser(updatedUser);
      localStorage.setItem('crm_user', JSON.stringify(updatedUser));
    }

    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('profiles')
        .update({ role })
        .eq('id', profileId);
    }
  };

  const createUserProfile = async (email: string, role: UserRole, name: string, phone?: string, password?: string): Promise<Profile> => {
    const id = `user-${Date.now()}`;
    const formattedPhone = phone ? (phone.startsWith('+') ? phone : `+91${phone}`) : undefined;
    const newProf: Profile = {
      id,
      full_name: name,
      role,
      phone: formattedPhone,
      created_at: new Date().toISOString()
    };
    
    // Update local state and storage
    const updatedProfiles = [...profiles, newProf];
    setProfiles(updatedProfiles);
    saveLocal('crm_profiles', updatedProfiles);

    // Save login credentials to sandbox localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('crm_credentials');
      const creds = stored ? JSON.parse(stored) : [];
      const alreadyExists = creds.some((c: any) => c.email.toLowerCase() === email.toLowerCase());
      if (!alreadyExists) {
        const updatedCreds = [...creds, {
          email,
          password: password || 'counsellor123',
          name,
          role,
          profileId: id,
          phone: formattedPhone
        }];
        localStorage.setItem('crm_credentials', JSON.stringify(updatedCreds));
      }
    }

    // Call Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('profiles')
          .insert({
            id,
            full_name: name,
            role,
            phone: formattedPhone,
            created_at: new Date().toISOString()
          });
      } catch (err) {
        console.error("Supabase profile insert error: ", err);
      }
    }

    // Trigger asynchronous Welcome Email dispatch with credentials
    try {
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
                    <td style="padding: 6px 0;"><a href="http://localhost:3000" style="color: #4f46e5; text-decoration: underline; font-weight: 600;">Perfect Scholar CRM Web</a></td>
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


  const updateSettings = (newSettings: Partial<CRMSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveLocal('crm_settings', updated);
  };

  // Lead Operations
  const addLead = async (leadData: Omit<Lead, 'id' | 'created_at' | 'updated_at'>): Promise<Lead> => {
    const newLeadItem = {
      ...leadData,
      id: `lead-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as Lead;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('leads')
        .insert([{
          ...leadData,
          tags: leadData.tags || [],
          score: leadData.score || 0
        }])
        .select()
        .single();
      if (error) throw error;
      
      // Log Action
      await supabase.from('activity_logs').insert([{
        lead_id: data.id,
        actor_id: currentUser?.id,
        action_type: 'lead_created',
        description: `Lead created from source: ${leadData.lead_source}`
      }]);
      
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
        .select()
        .single();
      if (error) throw error;

      // Log status change or update
      if (updates.status) {
        await supabase.from('activity_logs').insert([{
          lead_id: id,
          actor_id: currentUser?.id,
          action_type: 'status_change',
          description: `Status changed to: ${updates.status}`
        }]);
      }
      return data as Lead;
    } else {
      let updatedLead: Lead | null = null;
      const updatedLeads = leads.map(l => {
        if (l.id === id) {
          updatedLead = {
            ...l,
            ...updates,
            updated_at: new Date().toISOString()
          };
          return updatedLead;
        }
        return l;
      });

      if (!updatedLead) throw new Error("Lead not found");

      setLeads(updatedLeads);
      saveLocal('crm_leads', updatedLeads);

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

      return updatedLead;
    }
  };

  const deleteLead = async (id: string): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
      setLeads(prev => prev.filter(l => l.id !== id));
    } else {
      const updated = leads.filter(l => l.id !== id);
      setLeads(updated);
      saveLocal('crm_leads', updated);
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
        .insert([{ lead_id: leadId, author_id: currentUser?.id, content }])
        .select()
        .single();
      if (error) throw error;
      
      await supabase.from('activity_logs').insert([{
        lead_id: leadId,
        actor_id: currentUser?.id,
        action_type: 'note_added',
        description: `Added internal team note: "${content.substring(0, 40)}${content.length > 40 ? '...' : ''}"`
      }]);

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
    const newTask: Task = {
      id: `task-${Date.now()}`,
      lead_id: leadId,
      assignee_id: currentUser?.id || 'system',
      title,
      due_date: dueDate || new Date(Date.now() + 86400000 * 2).toISOString(), // +2 days default
      is_completed: false,
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ lead_id: leadId, assignee_id: currentUser?.id, title, due_date: dueDate }])
        .select()
        .single();
      if (error) throw error;

      await supabase.from('activity_logs').insert([{
        lead_id: leadId,
        actor_id: currentUser?.id,
        action_type: 'task_created',
        description: `Created task: "${title}"`
      }]);

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
        .select()
        .single();
      if (error) throw error;
      
      await supabase.from('activity_logs').insert([{
        lead_id: taskToToggle.lead_id,
        actor_id: currentUser?.id,
        action_type: 'task_completed',
        description: `Marked task "${taskToToggle.title}" as ${nextCompleted ? 'completed' : 'incomplete'}`
      }]);

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

    let body = template.body
      .replace('{{lead_name}}', lead.name)
      .replace('{{neet_marks}}', String(lead.neet_marks || 200))
      .replace('{{budget}}', lead.budget ? `${(lead.budget / 100000).toFixed(1)} Lakh` : '40 Lakh')
      .replace('{{preferred_destination}}', lead.preferred_destination || 'Georgia/Russia');

    const newMessage: WhatsAppMessage = {
      id: `wa-${Date.now()}`,
      lead_id: leadId,
      direction: 'outgoing',
      message_text: body,
      status: 'sent',
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      await supabase.from('whatsapp_history').insert([newMessage]);
      await supabase.from('activity_logs').insert([{
        lead_id: leadId,
        actor_id: currentUser?.id,
        action_type: 'whatsapp_sent',
        description: `Sent WhatsApp template: "${template.name}"`
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
    const newMessage: WhatsAppMessage = {
      id: `wa-${Date.now()}`,
      lead_id: leadId,
      direction: 'outgoing',
      message_text: message,
      status: 'sent',
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      await supabase.from('whatsapp_history').insert([newMessage]);
      await supabase.from('activity_logs').insert([{
        lead_id: leadId,
        actor_id: currentUser?.id,
        action_type: 'whatsapp_sent',
        description: `Sent manual WhatsApp: "${message.substring(0, 30)}..."`
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
      updateSettings,
      addLead,
      updateLead,
      deleteLead,
      addNote,
      addTask,
      toggleTask,
      sendWhatsAppTemplate,
      sendCustomWhatsApp,
      triggerLeadSimulation,
      isLoading
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
