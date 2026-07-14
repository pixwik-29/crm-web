-- 1. Enable partners to read notes related to their referred leads
DROP POLICY IF EXISTS "Partners can view notes for their referred students" ON public.notes;
CREATE POLICY "Partners can view notes for their referred students" ON public.notes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.partner_students s
            JOIN public.partner_users u ON s.partner_id = u.partner_id
            WHERE s.crm_lead_id = lead_id AND u.id = auth.uid()
        )
    );

-- 2. Allow CRM staff (profiles) to read partner users' details (to access push tokens)
DROP POLICY IF EXISTS "CRM profiles can read partner users" ON public.partner_users;
CREATE POLICY "CRM profiles can read partner users" ON public.partner_users
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid()
        )
    );

-- 3. Allow CRM staff (profiles) to select and update partner student records
DROP POLICY IF EXISTS "CRM profiles can select partner students" ON public.partner_students;
CREATE POLICY "CRM profiles can select partner students" ON public.partner_students
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "CRM profiles can update partner students" ON public.partner_students;
CREATE POLICY "CRM profiles can update partner students" ON public.partner_students
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid()
        )
    );

-- 4. Allow CRM staff (profiles) to insert partner announcements (in-app notifications)
DROP POLICY IF EXISTS "CRM profiles can insert announcements" ON public.partner_announcements;
CREATE POLICY "CRM profiles can insert announcements" ON public.partner_announcements
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid()
        )
    );
