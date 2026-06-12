const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gkayyfwadwwsucpqeefw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrYXl5ZndhZHd3c3VjcHFlZWZ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg2NzU0MCwiZXhwIjoyMDk1NDQzNTQwfQ.lv3_6tPCKHCwOOwtTFcI-0ERssAzA5O-ErC_A8h87Xw'
);

async function checkAdmins() {
  console.log('=== CRM Admin Accounts ===\n');

  // 1. Get all admin profiles
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, full_name, role, tenant_id, created_at')
    .eq('role', 'admin')
    .order('created_at', { ascending: false });

  if (pErr) { console.error('profiles error:', pErr.message); return; }

  // 2. Get all auth users
  const { data: { users }, error: uErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (uErr) { console.error('auth list error:', uErr.message); return; }

  const userMap = {};
  users.forEach(u => { userMap[u.id] = u; });

  console.log(`Found ${profiles.length} admin profile(s):\n`);
  for (const p of profiles) {
    const authUser = userMap[p.id];
    const email = authUser?.email || '(no auth user)';

    console.log(`  Email:     ${email}`);
    console.log(`  Name:      ${p.full_name}`);
    console.log(`  Role:      ${p.role}`);
    console.log(`  Tenant ID: ${p.tenant_id}`);
    console.log(`  Profile ID:${p.id}`);

    // Check subscription
    const { data: sub } = await supabase
      .from('crm_subscriptions')
      .select('status, plan, tenant_id')
      .eq('tenant_id', p.tenant_id)
      .single();
    console.log(`  Sub:       ${sub ? `${sub.status} / ${sub.plan}` : 'MISSING ❌'}`);

    if (authUser) {
      console.log(`  Confirmed: ${authUser.email_confirmed_at ? 'YES ✅' : 'NO ❌'}`);
      console.log(`  Banned:    ${authUser.banned_until ? authUser.banned_until + ' ❌' : 'no'}`);
    } else {
      console.log(`  Auth:      MISSING ❌ - no auth.users entry`);
    }
    console.log('');
  }

  // 3. Also check nash@pixwik.com specifically
  console.log('=== nash@pixwik.com specifically ===\n');
  const nashAuth = users.find(u => u.email === 'nash@pixwik.com');
  if (nashAuth) {
    const { data: nashProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', nashAuth.id)
      .single();
    const { data: sub } = await supabase
      .from('crm_subscriptions')
      .select('status, plan')
      .eq('tenant_id', nashProfile?.tenant_id)
      .single();
    console.log(`Auth ID:   ${nashAuth.id}`);
    console.log(`Confirmed: ${nashAuth.email_confirmed_at ? 'YES ✅' : 'NO ❌'}`);
    console.log(`Profile:   ${nashProfile ? `role=${nashProfile.role}, tenant=${nashProfile.tenant_id}` : 'MISSING ❌'}`);
    console.log(`Sub:       ${sub ? `${sub.status} / ${sub.plan}` : 'MISSING ❌'}`);
  } else {
    console.log('nash@pixwik.com not found in auth.users ❌');
  }
}

checkAdmins().catch(console.error);
