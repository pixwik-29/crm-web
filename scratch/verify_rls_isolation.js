const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Load Environment Variables from .env.local
const envPath = path.join(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env.local file not found');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('Error: Missing Supabase variables in .env.local');
  process.exit(1);
}

console.log('Supabase URL:', supabaseUrl);

// Create Admin Client (bypasses RLS for setup/cleanup)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Create Anon Client (respects RLS)
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runTest() {
  const userAEmail = `test.user.a.${Date.now()}@perfectscholar.com`;
  const userBEmail = `test.user.b.${Date.now()}@perfectscholar.com`;
  const testPassword = 'TestPassword123!';
  
  let userAId = null;
  let userBId = null;

  try {
    console.log('\n--- STEP 1: Creating Test Users via Admin client ---');
    
    // Create User A
    const { data: authA, error: errAuthA } = await supabaseAdmin.auth.admin.createUser({
      email: userAEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        full_name: 'Test Admin Tenant A',
        role: 'admin',
        tenant_id: 'tenant-a-test'
      }
    });
    if (errAuthA) throw new Error(`User A creation failed: ${errAuthA.message}`);
    userAId = authA.user.id;
    console.log(`User A created: ${userAEmail} (ID: ${userAId}, Tenant: tenant-a-test)`);

    // Create User B
    const { data: authB, error: errAuthB } = await supabaseAdmin.auth.admin.createUser({
      email: userBEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        full_name: 'Test Admin Tenant B',
        role: 'admin',
        tenant_id: 'tenant-b-test'
      }
    });
    if (errAuthB) throw new Error(`User B creation failed: ${errAuthB.message}`);
    userBId = authB.user.id;
    console.log(`User B created: ${userBEmail} (ID: ${userBId}, Tenant: tenant-b-test)`);

    // Wait a brief moment to ensure trigger propagation is completed
    await new Promise(r => setTimeout(r, 1000));

    console.log('\n--- STEP 2: Logging in as User A (Tenant A) ---');
    const { data: sessionA, error: errSessionA } = await supabaseAnon.auth.signInWithPassword({
      email: userAEmail,
      password: testPassword
    });
    if (errSessionA) throw new Error(`User A login failed: ${errSessionA.message}`);
    console.log('User A logged in successfully!');

    // Initialize authenticated anon client for A
    const clientA = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${sessionA.session.access_token}`
        }
      }
    });

    console.log('\n--- STEP 3: Inserting Lead under Tenant A ---');
    const { data: newLeadA, error: errLeadA } = await clientA
      .from('leads')
      .insert([{
        name: 'Lead for Tenant A',
        phone: '+919999888877',
        lead_source: 'RLS Testing',
        tenant_id: 'tenant-a-test'
      }])
      .select()
      .single();

    if (errLeadA) throw new Error(`User A Lead insertion failed: ${errLeadA.message}`);
    console.log(`Lead created by User A: "${newLeadA.name}" (ID: ${newLeadA.id}, Tenant: ${newLeadA.tenant_id})`);

    console.log('\n--- STEP 4: Querying Leads as User A ---');
    const { data: leadsForA, error: errGetA } = await clientA
      .from('leads')
      .select('*');
    if (errGetA) throw new Error(`User A lead query failed: ${errGetA.message}`);
    console.log(`User A read ${leadsForA.length} lead(s).`);
    leadsForA.forEach(l => {
      console.log(` - Lead Name: ${l.name}, Tenant ID: ${l.tenant_id}`);
    });

    console.log('\n--- STEP 5: Logging in as User B (Tenant B) ---');
    const { data: sessionB, error: errSessionB } = await supabaseAnon.auth.signInWithPassword({
      email: userBEmail,
      password: testPassword
    });
    if (errSessionB) throw new Error(`User B login failed: ${errSessionB.message}`);
    console.log('User B logged in successfully!');

    // Initialize authenticated anon client for B
    const clientB = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${sessionB.session.access_token}`
        }
      }
    });

    console.log('\n--- STEP 6: Querying Leads as User B (Should NOT see Tenant A leads) ---');
    const { data: leadsForB, error: errGetB } = await clientB
      .from('leads')
      .select('*');
    if (errGetB) throw new Error(`User B lead query failed: ${errGetB.message}`);
    
    console.log(`User B read ${leadsForB.length} lead(s).`);
    const foundAInB = leadsForB.some(l => l.tenant_id === 'tenant-a-test');
    if (foundAInB) {
      throw new Error('RLS VIOLATION: User B was able to view leads belonging to tenant-a-test!');
    } else {
      console.log('✅ Success: User B is isolated and cannot see Tenant A data!');
    }

    console.log('\n--- STEP 7: Attempting to insert a lead belonging to Tenant A as User B (Should Fail) ---');
    const { data: badLead, error: errBadLead } = await clientB
      .from('leads')
      .insert([{
        name: 'Malicious Tenant B Lead into Tenant A',
        phone: '+918888777766',
        lead_source: 'RLS Attack Testing',
        tenant_id: 'tenant-a-test'
      }])
      .select();

    if (errBadLead) {
      console.log(`✅ Success: Insert rejected as expected! Error message: "${errBadLead.message}"`);
    } else {
      throw new Error(`RLS VIOLATION: User B successfully inserted a lead belonging to "tenant-a-test"! (ID: ${badLead[0].id})`);
    }

    console.log('\n--- STEP 8: Inserting Lead under Tenant B ---');
    const { data: newLeadB, error: errLeadB } = await clientB
      .from('leads')
      .insert([{
        name: 'Lead for Tenant B',
        phone: '+918888888888',
        lead_source: 'RLS Testing',
        tenant_id: 'tenant-b-test'
      }])
      .select()
      .single();

    if (errLeadB) throw new Error(`User B Lead insertion failed: ${errLeadB.message}`);
    console.log(`Lead created by User B: "${newLeadB.name}" (ID: ${newLeadB.id}, Tenant: ${newLeadB.tenant_id})`);

    console.log('\n--- STEP 9: Querying Leads as User B again ---');
    const { data: leadsForBFinal, error: errGetBFinal } = await clientB
      .from('leads')
      .select('*');
    if (errGetBFinal) throw new Error(`User B lead query failed: ${errGetBFinal.message}`);
    console.log(`User B read ${leadsForBFinal.length} lead(s).`);
    leadsForBFinal.forEach(l => {
      console.log(` - Lead Name: ${l.name}, Tenant ID: ${l.tenant_id}`);
    });

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
  } finally {
    console.log('\n--- CLEANUP: Deleting test auth users ---');
    if (userAId) {
      const { error: delA } = await supabaseAdmin.auth.admin.deleteUser(userAId);
      if (delA) console.error('Failed to delete user A:', delA.message);
      else console.log('Test User A deleted.');
    }
    if (userBId) {
      const { error: delB } = await supabaseAdmin.auth.admin.deleteUser(userBId);
      if (delB) console.error('Failed to delete user B:', delB.message);
      else console.log('Test User B deleted.');
    }
    console.log('Testing execution completed.');
  }
}

runTest();
