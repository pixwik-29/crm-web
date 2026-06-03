-- Custom Types
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'counsellor');

-- Profiles Table (extension of auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'counsellor',
    phone TEXT,
    push_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Leads Table
CREATE TABLE public.leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    parent_contact TEXT,
    whatsapp_number TEXT,
    father_number TEXT,
    mother_number TEXT,
    neet_marks INTEGER,
    budget NUMERIC,
    preferred_destination TEXT, -- state or country
    course TEXT,
    lead_source TEXT NOT NULL DEFAULT 'Manual Entry', -- Facebook Ads, Instagram Ads, Google Ads, WhatsApp Campaign, Website Form, Referral, Organic, Manual Entry, YouTube, TikTok, Other
    campaign_name TEXT,
    adset_name TEXT,
    creative_name TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    landing_page_url TEXT,
    status TEXT NOT NULL DEFAULT '1st followup', -- 1st followup, Discussion stage, Connected to manager, Documents collected, Closed Won, Closed Lost
    assigned_counsellor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT '{}',
    score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Notes Table
CREATE TABLE public.notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tasks Table
CREATE TABLE public.tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
    assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    notification_sent BOOLEAN DEFAULT false NOT NULL,
    is_completed BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Activity Logs Table
CREATE TABLE public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL, -- 'status_change', 'note_added', 'task_created', 'task_completed', 'call_logged', 'whatsapp_sent', 'assigned'
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- WhatsApp History Table
CREATE TABLE public.whatsapp_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
    message_text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- WhatsApp Quick Reply Templates Table
CREATE TABLE public.whatsapp_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    body TEXT NOT NULL,
    attachment_url TEXT,
    attachment_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ROW LEVEL SECURITY (RLS) Configuration
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Allow public read for authenticated profiles" ON public.profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow update for owners" ON public.profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Leads Policies
CREATE POLICY "Admins can do everything on leads" ON public.leads
    FOR ALL TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager')
    );

CREATE POLICY "Counsellors can read assigned leads" ON public.leads
    FOR SELECT TO authenticated
    USING (
        assigned_counsellor_id = auth.uid()
    );

CREATE POLICY "Counsellors can update assigned leads" ON public.leads
    FOR UPDATE TO authenticated
    USING (
        assigned_counsellor_id = auth.uid()
    );

CREATE POLICY "Counsellors can insert leads" ON public.leads
    FOR INSERT TO authenticated
    WITH CHECK (
        -- Can insert leads if they assign it to themselves, or leave empty
        assigned_counsellor_id = auth.uid() OR assigned_counsellor_id IS NULL
    );

-- Notes Policies
CREATE POLICY "Admins can manage notes" ON public.notes
    FOR ALL TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager')
    );

CREATE POLICY "Counsellors can manage notes for assigned leads" ON public.notes
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.leads 
            WHERE id = lead_id AND assigned_counsellor_id = auth.uid()
        )
    );

-- Tasks Policies
CREATE POLICY "Admins can manage tasks" ON public.tasks
    FOR ALL TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager')
    );

CREATE POLICY "Counsellors can manage tasks for assigned leads" ON public.tasks
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.leads 
            WHERE id = lead_id AND assigned_counsellor_id = auth.uid()
        )
    );

-- Activity Logs Policies
CREATE POLICY "Admins can manage activity logs" ON public.activity_logs
    FOR ALL TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager')
    );

CREATE POLICY "Counsellors can read activity logs for assigned leads" ON public.activity_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.leads 
            WHERE id = lead_id AND assigned_counsellor_id = auth.uid()
        )
    );

CREATE POLICY "Counsellors can write activity logs for assigned leads" ON public.activity_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.leads 
            WHERE id = lead_id AND assigned_counsellor_id = auth.uid()
        )
    );

-- WhatsApp History Policies
CREATE POLICY "Admins can manage WhatsApp history" ON public.whatsapp_history
    FOR ALL TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager')
    );

CREATE POLICY "Counsellors can manage WhatsApp history for assigned leads" ON public.whatsapp_history
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.leads 
            WHERE id = lead_id AND assigned_counsellor_id = auth.uid()
        )
    );

-- WhatsApp Templates Policies
CREATE POLICY "All authenticated users can read templates" ON public.whatsapp_templates
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage templates" ON public.whatsapp_templates
    FOR ALL TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager')
    );


-- Trigger to automatically create a profile record when a new user registers in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  default_role public.user_role := 'counsellor'::public.user_role;
  actual_role public.user_role;
  meta_role text;
BEGIN
  -- Safely extract and check role from metadata
  actual_role := default_role;
  IF new.raw_user_meta_data IS NOT NULL THEN
    meta_role := new.raw_user_meta_data->>'role';
    IF meta_role IS NOT NULL AND meta_role <> '' THEN
      BEGIN
        actual_role := meta_role::public.user_role;
      EXCEPTION WHEN OTHERS THEN
        actual_role := default_role;
      END;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, full_name, role, phone)
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'full_name', 
      CASE WHEN new.email IS NOT NULL THEN split_part(new.email, '@', 1) ELSE NULL END,
      'New Counsellor'
    ),
    actual_role,
    CASE 
      WHEN new.raw_user_meta_data IS NOT NULL THEN new.raw_user_meta_data->>'phone'
      ELSE NULL
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop trigger first to prevent duplicate key/trigger errors if rerun
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- Insert some default WhatsApp templates
INSERT INTO public.whatsapp_templates (name, body) VALUES
('Welcome Message', 'Hello {{lead_name}}, thank you for reaching out to MBBS Admission Consultancy. We have received your query for studying MBBS in {{preferred_destination}}. A counsellor will get in touch with you shortly.'),
('Follow-up NEET Marks', 'Dear {{lead_name}}, we noticed you scored {{neet_marks}} in NEET. We have excellent medical college options within your budget of {{budget}} in {{preferred_destination}}. Let us know a good time to connect!'),
('Document Checklist', 'Hi {{lead_name}}, please share your 10th and 12th marksheet along with your NEET scorecard so we can begin the eligibility assessment process.');

-- MIGRATION NOTES FOR EXISTING DATABASES:
-- Run these queries in your Supabase SQL Editor if upgrading from an older version:
-- 1. ALTER TABLE public.leads ADD COLUMN course TEXT;
-- 2. ALTER TABLE public.profiles ADD COLUMN push_token TEXT;
-- 3. Run this to set up Supabase Storage for WhatsApp brochures/attachments:
--    INSERT INTO storage.buckets (id, name, public) VALUES ('whatsapp_attachments', 'whatsapp_attachments', true) ON CONFLICT (id) DO NOTHING;
--    CREATE POLICY "Allow public read access" ON storage.objects FOR SELECT USING (bucket_id = 'whatsapp_attachments');
--    CREATE POLICY "Allow auth upload access" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'whatsapp_attachments');
--    CREATE POLICY "Allow auth manage access" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'whatsapp_attachments');

-- 4. RPC to safely verify if a phone number is registered without requiring prior authentication (RLS bypass)
CREATE OR REPLACE FUNCTION public.check_phone_registered(phone_num TEXT)
RETURNS TABLE(registered BOOLEAN, email TEXT, full_name TEXT, role TEXT) AS $$
DECLARE
  clean_input TEXT;
BEGIN
  clean_input := regexp_replace(phone_num, '\D', '', 'g');
  RETURN QUERY
  SELECT 
    TRUE as registered,
    au.email::TEXT,
    p.full_name::TEXT,
    p.role::TEXT
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE 
    regexp_replace(p.phone, '\D', '', 'g') = clean_input
    OR regexp_replace(p.phone, '\D', '', 'g') = '91' || clean_input
    OR (length(clean_input) >= 10 AND regexp_replace(p.phone, '\D', '', 'g') LIKE '%' || clean_input)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


