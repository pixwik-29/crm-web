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

async function main() {
  console.log('1. Login as john@elite.com using anon key (simulating mobile client)...');
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  
  const { data: session, error: loginErr } = await anonClient.auth.signInWithPassword({
    email: 'john@elite.com',
    password: 'partner_default_pass_123'
  });
  
  if (loginErr) {
    console.error('❌ Login failed:', loginErr.message);
    return;
  }
  console.log('✅ Logged in as john@elite.com, user id:', session.user.id);

  console.log('\n2. Fetching partner_students with user JWT (RLS test)...');
  const { data: students, error: studErr } = await anonClient
    .from('partner_students')
    .select('id, first_name, last_name, phone, partner_id')
    .limit(10);
  
  if (studErr) {
    console.error('❌ SELECT failed with RLS error:', studErr.message, studErr.code);
    console.log('\nThis means the migration has NOT been applied or there is an RLS issue.');
  } else {
    console.log(`✅ SELECT succeeded! Found ${students.length} student(s).`);
    students.forEach(s => console.log(`  - ${s.first_name} ${s.last_name} | partner_id: ${s.partner_id}`));
  }
  
  console.log('\n3. Testing get_auth_user_partner_id() helper function...');
  const { data: pid, error: pidErr } = await anonClient
    .rpc('get_auth_user_partner_id');

  if (pidErr) {
    console.error('❌ get_auth_user_partner_id() failed:', pidErr.message, '(Migration likely not applied!)');
  } else {
    console.log('✅ get_auth_user_partner_id() returned:', pid);
  }
  
  await anonClient.auth.signOut();
}

main();
