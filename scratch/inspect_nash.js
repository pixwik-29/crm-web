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
  console.log("Listing all auth users:");
  const { data: authUsers, error: errAuth } = await supabase.auth.admin.listUsers();
  if (errAuth) {
    console.error("Error fetching auth users:", errAuth);
    return;
  }
  authUsers.users.forEach(u => {
    console.log(`- ID: ${u.id} | Email: ${u.email} | Created At: ${u.created_at}`);
  });
}

main();
