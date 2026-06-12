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
  console.log("=== INSPECTING PIPELINES ===");
  const { data: pipelines, error: errPipe } = await supabase.from('pipelines').select('*');
  if (errPipe) {
    console.error("Error fetching pipelines:", errPipe);
  } else {
    console.log(`Found ${pipelines.length} pipelines:`);
    pipelines.forEach(p => {
      console.log(`- ID: ${p.id} | Name: ${p.name} | is_default: ${p.is_default} | tenant_id: ${p.tenant_id}`);
    });
  }

  console.log("\n=== INSPECTING PIPELINE ACCESS ===");
  const { data: access, error: errAccess } = await supabase.from('pipeline_access').select('*');
  if (errAccess) {
    console.error("Error fetching pipeline_access:", errAccess);
  } else {
    console.log(`Found ${access.length} access rows:`);
    access.forEach(a => {
      console.log(`- Pipeline ID: ${a.pipeline_id} | Profile ID: ${a.profile_id} | tenant_id: ${a.tenant_id}`);
    });
  }

  console.log("\n=== INSPECTING PROFILES ===");
  const { data: profiles, error: errProf } = await supabase.from('profiles').select('*');
  if (errProf) {
    console.error("Error fetching profiles:", errProf);
  } else {
    console.log(`Found ${profiles.length} profiles:`);
    profiles.forEach(p => {
      console.log(`- ID: ${p.id} | Name: ${p.full_name} | Role: ${p.role} | tenant_id: ${p.tenant_id}`);
    });
  }
}

main();
