const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log("Applying RLS infinite recursion fixes to the database...");

  const sql = `
    -- 1. Create Helper Functions with SECURITY DEFINER to avoid RLS recursion
    CREATE OR REPLACE FUNCTION public.get_auth_user_role()
    RETURNS TEXT AS $$
    DECLARE
      user_role TEXT;
    BEGIN
      SELECT role::TEXT INTO user_role FROM public.partner_users WHERE id = auth.uid();
      RETURN COALESCE(user_role, 'consultant_agency');
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

    CREATE OR REPLACE FUNCTION public.get_auth_user_partner_id()
    RETURNS UUID AS $$
    DECLARE
      user_partner_id UUID;
    BEGIN
      SELECT partner_id INTO user_partner_id FROM public.partner_users WHERE id = auth.uid();
      RETURN user_partner_id;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

    -- 2. Drop and recreate policies on partners
    DROP POLICY IF EXISTS "Admins can view and edit all partners" ON public.partners;
    CREATE POLICY "Admins can view and edit all partners" ON public.partners
        FOR ALL TO authenticated USING (
            public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        );

    DROP POLICY IF EXISTS "Partner Users can read their own agency partner record" ON public.partners;
    CREATE POLICY "Partner Users can read their own agency partner record" ON public.partners
        FOR SELECT TO authenticated USING (
            id = public.get_auth_user_partner_id()
        );

    -- 3. Drop and recreate policies on partner_users
    DROP POLICY IF EXISTS "Admins can manage all partner users" ON public.partner_users;
    CREATE POLICY "Admins can manage all partner users" ON public.partner_users
        FOR ALL TO authenticated USING (
            public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        );

    DROP POLICY IF EXISTS "Users can read profiles from the same partner agency" ON public.partner_users;
    CREATE POLICY "Users can read profiles from the same partner agency" ON public.partner_users
        FOR SELECT TO authenticated USING (
            partner_id = public.get_auth_user_partner_id()
        );

    -- 4. Drop and recreate policies on partner_students
    DROP POLICY IF EXISTS "Admins can manage all student submissions" ON public.partner_students;
    CREATE POLICY "Admins can manage all student submissions" ON public.partner_students
        FOR ALL TO authenticated USING (
            public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        );

    DROP POLICY IF EXISTS "Partners can read and write student submissions from their own agency" ON public.partner_students;
    CREATE POLICY "Partners can read and write student submissions from their own agency" ON public.partner_students
        FOR ALL TO authenticated USING (
            partner_id = public.get_auth_user_partner_id()
        );

    -- 5. Drop and recreate policies on partner_uploaded_docs
    DROP POLICY IF EXISTS "Admins can manage all uploaded student docs" ON public.partner_uploaded_docs;
    CREATE POLICY "Admins can manage all uploaded student docs" ON public.partner_uploaded_docs
        FOR ALL TO authenticated USING (
            public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        );

    DROP POLICY IF EXISTS "Partners can manage docs for their own students" ON public.partner_uploaded_docs;
    CREATE POLICY "Partners can manage docs for their own students" ON public.partner_uploaded_docs
        FOR ALL TO authenticated USING (
            EXISTS (
                SELECT 1 FROM public.partner_students s
                WHERE s.id = student_id AND s.partner_id = public.get_auth_user_partner_id()
            )
        );

    -- 6. Drop and recreate policies on LMS tables
    DROP POLICY IF EXISTS "Admins can manage LMS courses" ON public.partner_lms_courses;
    CREATE POLICY "Admins can manage LMS courses" ON public.partner_lms_courses 
        FOR ALL TO authenticated USING (
            public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        );

    DROP POLICY IF EXISTS "Admins can manage LMS modules" ON public.partner_lms_modules;
    CREATE POLICY "Admins can manage LMS modules" ON public.partner_lms_modules 
        FOR ALL TO authenticated USING (
            public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        );

    DROP POLICY IF EXISTS "Admins can manage LMS quizzes" ON public.partner_lms_quizzes;
    CREATE POLICY "Admins can manage LMS quizzes" ON public.partner_lms_quizzes 
        FOR ALL TO authenticated USING (
            public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        );

    DROP POLICY IF EXISTS "Admins can read all LMS progress logs" ON public.partner_lms_progress;
    CREATE POLICY "Admins can read all LMS progress logs" ON public.partner_lms_progress
        FOR SELECT TO authenticated USING (
            public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        );

    DROP POLICY IF EXISTS "Admins can manage all certs" ON public.partner_lms_certificates;
    CREATE POLICY "Admins can manage all certs" ON public.partner_lms_certificates 
        FOR ALL TO authenticated USING (
            public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        );

    -- 7. Drop and recreate policies on partner_commissions
    DROP POLICY IF EXISTS "Admins can manage all commissions log entries" ON public.partner_commissions;
    CREATE POLICY "Admins can manage all commissions log entries" ON public.partner_commissions
        FOR ALL TO authenticated USING (
            public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        );

    DROP POLICY IF EXISTS "Partners can read commissions from their own agency" ON public.partner_commissions;
    CREATE POLICY "Partners can read commissions from their own agency" ON public.partner_commissions
        FOR SELECT TO authenticated USING (
            partner_id = public.get_auth_user_partner_id()
        );

    -- 7b. Drop and recreate policies on commission_packages
    DROP POLICY IF EXISTS "Admins can manage commission_packages" ON public.commission_packages;
    CREATE POLICY "Admins can manage commission_packages" ON public.commission_packages
        FOR ALL TO authenticated USING (
            public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        );

    -- 8. Drop and recreate policies on partner_tickets
    DROP POLICY IF EXISTS "Admins can view and edit all support tickets" ON public.partner_tickets;
    CREATE POLICY "Admins can view and edit all support tickets" ON public.partner_tickets
        FOR ALL TO authenticated USING (
            public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        );

    DROP POLICY IF EXISTS "Partners can manage support tickets for their own agency" ON public.partner_tickets;
    CREATE POLICY "Partners can manage support tickets for their own agency" ON public.partner_tickets
        FOR ALL TO authenticated USING (
            partner_id = public.get_auth_user_partner_id()
        );

    -- 9. Drop and recreate policies on partner_ticket_replies
    DROP POLICY IF EXISTS "Admins can manage all ticket replies" ON public.partner_ticket_replies;
    CREATE POLICY "Admins can manage all ticket replies" ON public.partner_ticket_replies
        FOR ALL TO authenticated USING (
            public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        );

    DROP POLICY IF EXISTS "Partners can read/write ticket replies for their own tickets" ON public.partner_ticket_replies;
    CREATE POLICY "Partners can read/write ticket replies for their own tickets" ON public.partner_ticket_replies
        FOR ALL TO authenticated USING (
            EXISTS (
                SELECT 1 FROM public.partner_tickets t
                WHERE t.id = ticket_id AND t.partner_id = public.get_auth_user_partner_id()
            )
        );

    -- 10. Drop and recreate policies on partner_announcements
    DROP POLICY IF EXISTS "Admins can manage announcements" ON public.partner_announcements;
    CREATE POLICY "Admins can manage announcements" ON public.partner_announcements
        FOR ALL TO authenticated USING (
            public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        );

    -- 11. Drop and recreate policies on partner_downloads_log
    DROP POLICY IF EXISTS "Admins can read all downloads logs" ON public.partner_downloads_log;
    CREATE POLICY "Admins can read all downloads logs" ON public.partner_downloads_log 
        FOR SELECT TO authenticated USING (
            public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        );

    DROP POLICY IF EXISTS "Partners can write own downloads logs" ON public.partner_downloads_log;
    CREATE POLICY "Partners can write own downloads logs" ON public.partner_downloads_log 
        FOR INSERT TO authenticated WITH CHECK (
            partner_id = public.get_auth_user_partner_id()
        );

    -- 12. Drop and recreate policies on crm_subscriptions
    DROP POLICY IF EXISTS "Admins can view and edit all subscriptions" ON public.crm_subscriptions;
    CREATE POLICY "Admins can view and edit all subscriptions" ON public.crm_subscriptions
        FOR ALL TO authenticated USING (
            public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        );

    -- Allow CRM users to verify their subscription status
    DROP POLICY IF EXISTS "Users can view their own subscription" ON public.crm_subscriptions;
    CREATE POLICY "Users can view their own subscription" ON public.crm_subscriptions
        FOR SELECT TO authenticated USING (
            id::text = public.get_auth_user_tenant()
        );
  `;

  const { data, error } = await supabase.rpc('exec_sql', { query: sql });

  if (error) {
    console.error("Migration execution failed:", error);
  } else {
    console.log("Migration executed successfully!");
  }
}

main();
