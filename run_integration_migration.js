const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync('.env.local', 'utf8');
const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log("Applying partner integration and visa pipeline migration to the database...");

  const migrationFilePath = path.join(__dirname, '../supabase/migration_crm_partner_integration.sql');
  const sql = fs.readFileSync(migrationFilePath, 'utf8');

  const { data, error } = await supabase.rpc('exec_sql', { query: sql });

  if (error) {
    console.error("Migration execution failed:", error);
  } else {
    console.log("Migration executed successfully!");
  }
}

main();
