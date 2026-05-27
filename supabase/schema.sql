-- Custom Types
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'counsellor');

-- Profiles Table (extension of auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'counsellor',
    phone TEXT,
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
BEGIN
  INSERT INTO public.profiles (id, full_name, role, phone)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'New Counsellor'),
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'counsellor'::user_role),
    new.raw_user_meta_data->>'phone'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- Insert some default WhatsApp templates
INSERT INTO public.whatsapp_templates (name, body) VALUES
('Welcome Message', 'Hello {{lead_name}}, thank you for reaching out to MBBS Admission Consultancy. We have received your query for studying MBBS in {{preferred_destination}}. A counsellor will get in touch with you shortly.'),
('Follow-up NEET Marks', 'Dear {{lead_name}}, we noticed you scored {{neet_marks}} in NEET. We have excellent medical college options within your budget of {{budget}} in {{preferred_destination}}. Let us know a good time to connect!'),
('Document Checklist', 'Hi {{lead_name}}, please share your 10th and 12th marksheet along with your NEET scorecard so we can begin the eligibility assessment process.');

-- MIGRATION NOTE FOR EXISTING DATABASES:
-- If you are updating an existing database, run this query in your Supabase SQL Editor:
-- ALTER TABLE public.leads ADD COLUMN course TEXT;

