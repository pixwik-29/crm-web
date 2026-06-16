-- =========================================================================
-- DATABASE MIGRATION: FIX CRM ADMIN ACCESS TO PARTNER PORTAL TABLES (RLS)
-- Run these statements in your Supabase SQL Editor to allow CRM admins
-- to view, verify, reject, and manage partner uploaded documents and data.
-- =========================================================================

-- 1. Drop and recreate policies on partners to allow CRM profiles to view and edit
DROP POLICY IF EXISTS "Admins can view and edit all partners" ON public.partners;
CREATE POLICY "Admins can view and edit all partners" ON public.partners
    FOR ALL TO authenticated 
    USING (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    );

-- 2. Drop and recreate policies on partner_users to allow CRM profiles to manage
DROP POLICY IF EXISTS "Admins can manage all partner users" ON public.partner_users;
CREATE POLICY "Admins can manage all partner users" ON public.partner_users
    FOR ALL TO authenticated 
    USING (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    );

-- 3. Drop and recreate policies on partner_students to allow CRM profiles to view and manage
DROP POLICY IF EXISTS "Admins can manage all student submissions" ON public.partner_students;
CREATE POLICY "Admins can manage all student submissions" ON public.partner_students
    FOR ALL TO authenticated 
    USING (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    );

-- 4. Drop and recreate policies on partner_uploaded_docs to allow CRM profiles to verify/reject docs
DROP POLICY IF EXISTS "Admins can manage all uploaded student docs" ON public.partner_uploaded_docs;
CREATE POLICY "Admins can manage all uploaded student docs" ON public.partner_uploaded_docs
    FOR ALL TO authenticated 
    USING (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    );

-- 5. Drop and recreate policies on partner_commissions to allow CRM profiles to manage
DROP POLICY IF EXISTS "Admins can manage all commissions log entries" ON public.partner_commissions;
CREATE POLICY "Admins can manage all commissions log entries" ON public.partner_commissions
    FOR ALL TO authenticated 
    USING (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    );

-- 6. Drop and recreate policies on commission_packages to allow CRM profiles to manage
DROP POLICY IF EXISTS "Admins can manage commission_packages" ON public.commission_packages;
CREATE POLICY "Admins can manage commission_packages" ON public.commission_packages
    FOR ALL TO authenticated 
    USING (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    );

-- 7. Drop and recreate policies on partner_tickets to allow CRM profiles to manage
DROP POLICY IF EXISTS "Admins can view and edit all support tickets" ON public.partner_tickets;
CREATE POLICY "Admins can view and edit all support tickets" ON public.partner_tickets
    FOR ALL TO authenticated 
    USING (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    );

-- 8. Drop and recreate policies on partner_ticket_replies to allow CRM profiles to manage
DROP POLICY IF EXISTS "Admins can manage all ticket replies" ON public.partner_ticket_replies;
CREATE POLICY "Admins can manage all ticket replies" ON public.partner_ticket_replies
    FOR ALL TO authenticated 
    USING (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    );

-- 9. Drop and recreate policies on partner_announcements to allow CRM profiles to manage
DROP POLICY IF EXISTS "Admins can manage announcements" ON public.partner_announcements;
CREATE POLICY "Admins can manage announcements" ON public.partner_announcements
    FOR ALL TO authenticated 
    USING (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    );

-- 10. Drop and recreate policies on partner_downloads_log to allow CRM profiles to read
DROP POLICY IF EXISTS "Admins can read all downloads logs" ON public.partner_downloads_log;
CREATE POLICY "Admins can read all downloads logs" ON public.partner_downloads_log 
    FOR SELECT TO authenticated 
    USING (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    );

-- 11. Drop and recreate policies on crm_subscriptions to allow CRM profiles to manage
DROP POLICY IF EXISTS "Admins can view and edit all subscriptions" ON public.crm_subscriptions;
CREATE POLICY "Admins can view and edit all subscriptions" ON public.crm_subscriptions
    FOR ALL TO authenticated 
    USING (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    );

-- 12. Drop and recreate policies on partner_creatives to allow CRM profiles to manage
DROP POLICY IF EXISTS "Admins can manage partner_creatives" ON public.partner_creatives;
CREATE POLICY "Admins can manage partner_creatives" ON public.partner_creatives
    FOR ALL TO authenticated 
    USING (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    );

-- 13. Drop and recreate policies on partner_colleges to allow CRM profiles to manage
DROP POLICY IF EXISTS "Admins can manage partner_colleges" ON public.partner_colleges;
CREATE POLICY "Admins can manage partner_colleges" ON public.partner_colleges
    FOR ALL TO authenticated 
    USING (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    );

-- 14. Drop and recreate policies on LMS tables to allow CRM profiles to manage
DROP POLICY IF EXISTS "Admins can manage LMS courses" ON public.partner_lms_courses;
CREATE POLICY "Admins can manage LMS courses" ON public.partner_lms_courses 
    FOR ALL TO authenticated 
    USING (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Admins can manage LMS modules" ON public.partner_lms_modules;
CREATE POLICY "Admins can manage LMS modules" ON public.partner_lms_modules 
    FOR ALL TO authenticated 
    USING (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Admins can manage LMS quizzes" ON public.partner_lms_quizzes;
CREATE POLICY "Admins can manage LMS quizzes" ON public.partner_lms_quizzes 
    FOR ALL TO authenticated 
    USING (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Admins can read all LMS progress logs" ON public.partner_lms_progress;
CREATE POLICY "Admins can read all LMS progress logs" ON public.partner_lms_progress
    FOR SELECT TO authenticated 
    USING (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Admins can manage all certs" ON public.partner_lms_certificates;
CREATE POLICY "Admins can manage all certs" ON public.partner_lms_certificates 
    FOR ALL TO authenticated 
    USING (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    );
