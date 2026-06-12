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
  console.log("=== CREATING AUTO PIPELINE ACCESS TRIGGER ===");

  const sql = `
CREATE OR REPLACE FUNCTION public.handle_new_profile_pipeline_access()
RETURNS TRIGGER AS $$
BEGIN
    -- Grant access to all default pipelines of the new profile's tenant, plus Visa pipeline
    INSERT INTO public.pipeline_access (pipeline_id, profile_id, tenant_id)
    SELECT id, NEW.id, NEW.tenant_id
    FROM public.pipelines
    WHERE tenant_id = NEW.tenant_id AND (is_default = true OR name = 'Visa/Post-Closing Pipeline')
    ON CONFLICT (pipeline_id, profile_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_pipeline_access ON public.profiles;
CREATE TRIGGER on_profile_created_pipeline_access
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_profile_pipeline_access();
  `;

  console.log("Applying SQL via exec_sql...");
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });

  if (error) {
    console.error("Failed to create trigger:", error);
  } else {
    console.log("Trigger and function created successfully!", data);
  }
}

main();
