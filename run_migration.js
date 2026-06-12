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
  console.log("Reading migration_fix_recursion.sql...");
  const migrationSql = fs.readFileSync('../supabase/migration_fix_recursion.sql', 'utf8');

  console.log("Applying complete migration to the database...");
  const { data, error } = await supabase.rpc('exec_sql', { query: migrationSql });

  if (error) {
    console.error("Migration execution failed:", error);
  } else {
    console.log("Migration executed successfully!", data);
  }
}

main();
