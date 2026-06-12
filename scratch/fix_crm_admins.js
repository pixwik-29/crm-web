const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gkayyfwadwwsucpqeefw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrYXl5ZndhZHd3c3VjcHFlZWZ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg2NzU0MCwiZXhwIjoyMDk1NDQzNTQwfQ.lv3_6tPCKHCwOOwtTFcI-0ERssAzA5O-ErC_A8h87Xw'
);

async function fixAll() {

  // ─── FIX 1: Restore subscription for test@perfectscholar.com ───────────────
  console.log('=== Fix 1: test@perfectscholar.com subscription ===\n');
  const TEST_TENANT = 'test-user-84571';

  const { data: existingSub } = await supabase
    .from('crm_subscriptions')
    .select('id, status, plan')
    .eq('tenant_id', TEST_TENANT)
    .maybeSingle();

  if (existingSub) {
    console.log('Sub already exists:', existingSub);
  } else {
    const { data: newSub, error: subErr } = await supabase
      .from('crm_subscriptions')
      .insert({
        tenant_id: TEST_TENANT,
        plan: 'professional',
        status: 'active',
        max_users: 10,
        max_leads: 10000,
        billing_cycle: 'monthly',
        started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (subErr) {
      console.error('Failed to create sub:', subErr.message);
    } else {
      console.log('✅ Subscription created:', newSub.id);
    }
  }

  // ─── FIX 2: Re-create nash@pixwik.com in auth ──────────────────────────────
  console.log('\n=== Fix 2: Re-create nash@pixwik.com ===\n');

  // Check if profile exists
  const NASH_TENANT = 'nash-pixwik-admin';
  const { data: nashProfile } = await supabase
    .from('profiles')
    .select('id, role, tenant_id')
    .eq('full_name', 'Nash Newton')
    .maybeSingle();

  let nashTenantId = nashProfile?.tenant_id || NASH_TENANT;

  // Create auth user
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: 'nash@pixwik.com',
    password: 'Pixwik@8899',
    email_confirm: true,
    user_metadata: {
      full_name: 'Nash Newton',
      role: 'admin',
      tenant_id: nashTenantId
    }
  });

  if (authErr) {
    if (authErr.message.includes('already')) {
      console.log('⚠️  Auth user already exists:', authErr.message);
    } else {
      console.error('Auth create failed:', authErr.message);
      return;
    }
  } else {
    const nashId = authData.user.id;
    console.log('✅ Auth user created:', nashId);

    // Create/update profile
    const { error: profErr } = await supabase
      .from('profiles')
      .upsert({
        id: nashId,
        full_name: 'Nash Newton',
        role: 'admin',
        tenant_id: nashTenantId
      }, { onConflict: 'id' });

    if (profErr) {
      console.error('Profile upsert failed:', profErr.message);
    } else {
      console.log('✅ Profile upserted, tenant:', nashTenantId);
    }

    // Create subscription if missing
    const { data: nashSub } = await supabase
      .from('crm_subscriptions')
      .select('id')
      .eq('tenant_id', nashTenantId)
      .maybeSingle();

    if (!nashSub) {
      const { error: nsErr } = await supabase
        .from('crm_subscriptions')
        .insert({
          tenant_id: nashTenantId,
          plan: 'professional',
          status: 'active',
          max_users: 10,
          max_leads: 10000,
          billing_cycle: 'monthly',
          started_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        });
      if (nsErr) console.error('Nash sub failed:', nsErr.message);
      else console.log('✅ Subscription created for nash tenant:', nashTenantId);
    } else {
      console.log('Sub already exists for nash tenant');
    }
  }

  // ─── VERIFICATION ───────────────────────────────────────────────────────────
  console.log('\n=== Final Verification ===\n');

  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const testUser = users.find(u => u.email === 'test@perfectscholar.com');
  const nashUser = users.find(u => u.email === 'nash@pixwik.com');

  const { data: testSub } = await supabase.from('crm_subscriptions').select('status').eq('tenant_id', TEST_TENANT).maybeSingle();

  console.log(`test@perfectscholar.com: auth=${testUser ? 'OK' : 'MISSING'}, sub=${testSub ? testSub.status : 'MISSING'}`);
  console.log(`nash@pixwik.com:         auth=${nashUser ? 'OK' : 'MISSING'}`);
}

fixAll().catch(console.error);
