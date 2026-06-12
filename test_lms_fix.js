const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = './.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');

const adminClient = createClient(supabaseUrl, supabaseServiceKey);
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

const SQL_MIGRATION = `
-- Fix partner_lms_progress RLS: allow users to manage their own progress
DROP POLICY IF EXISTS "Partners can manage their own LMS progress" ON public.partner_lms_progress;
CREATE POLICY "Partners can manage their own LMS progress" ON public.partner_lms_progress
    FOR ALL TO authenticated USING (
        user_id = auth.uid()
    );

-- Fix partner_lms_certificates RLS: allow users to manage their own certs
DROP POLICY IF EXISTS "Partners can manage their own certificates" ON public.partner_lms_certificates;
CREATE POLICY "Partners can manage their own certificates" ON public.partner_lms_certificates
    FOR ALL TO authenticated USING (
        user_id = auth.uid()
    );

-- Alter course_id columns to TEXT to support non-UUID string IDs from mobile
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'partner_lms_progress'
          AND column_name = 'course_id'
          AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.partner_lms_progress ALTER COLUMN course_id TYPE TEXT USING course_id::TEXT;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'partner_lms_certificates'
          AND column_name = 'course_id'
          AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.partner_lms_certificates ALTER COLUMN course_id TYPE TEXT USING course_id::TEXT;
    END IF;
END;
$$;
`;

async function main() {
  console.log('Applying LMS migration fixes to Supabase...\n');

  // Execute via rpc exec (requires pg_execute or similar)
  // Since we have service role, let's use the REST SQL endpoint
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify({ sql: SQL_MIGRATION })
  });

  if (!response.ok) {
    // Try direct SQL via the pg endpoint
    console.log('RPC method failed, verifying manually...');
  }

  // Verify the policies by testing as john
  console.log('\nVerifying with john@elite.com JWT...');
  const { data: session, error: loginErr } = await anonClient.auth.signInWithPassword({
    email: 'john@elite.com',
    password: 'partner_default_pass_123'
  });

  if (loginErr) {
    console.error('❌ Login failed:', loginErr.message);
    return;
  }
  console.log('✅ Logged in as john@elite.com');

  // Test LMS progress upsert with text course ID
  const { error: progErr } = await anonClient
    .from('partner_lms_progress')
    .upsert({
      user_id: session.user.id,
      course_id: 'course-1',
      modules_completed: ['module-1'],
      quiz_score: 85,
      is_completed: true,
      completed_at: new Date().toISOString()
    }, { onConflict: 'user_id,course_id' });

  if (progErr) {
    console.error('❌ LMS progress upsert failed:', progErr.message, progErr.code);
    console.log('\n⚠️  MIGRATION NOT APPLIED YET - Run migration_fix_recursion.sql in Supabase SQL Editor!');
  } else {
    console.log('✅ LMS progress upserted successfully with course_id: "course-1"');
  }

  // Test reading students (should show Bob Builder)
  const { data: students, error: sErr } = await anonClient
    .from('partner_students')
    .select('id, first_name, last_name, application_status')
    .limit(10);

  if (sErr) {
    console.error('❌ Students read failed:', sErr.message);
  } else {
    console.log(`✅ Students visible: ${students.length}`);
    students.forEach(s => console.log(`  - ${s.first_name} ${s.last_name} | ${s.application_status}`));
  }

  await anonClient.auth.signOut();
}

main();
