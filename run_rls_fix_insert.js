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
  console.log("Applying RLS WITH CHECK fix for partners table...");

  const sql = `
    DROP POLICY IF EXISTS "Admins can view and edit all partners" ON public.partners;
    CREATE POLICY "Admins can view and edit all partners" ON public.partners
        FOR ALL TO authenticated 
        USING (
            public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
        )
        WITH CHECK (
            public.get_auth_user_role() IN ('super_admin', 'admin', 'partner_manager')
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
