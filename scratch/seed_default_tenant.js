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

const DEFAULT_PIPELINE_STAGES = [
  { id: '1st followup', name: '1st followup', color: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400', order: 0 },
  { id: 'Discussion stage', name: 'Discussion stage', color: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400', order: 1 },
  { id: 'Registration / form filling', name: 'Registration / form filling', color: 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400', order: 2 },
  { id: 'Admission letter', name: 'Admission letter', color: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400', order: 3 },
  { id: 'Closed Won', name: 'Closed Won', color: 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400', order: 4 }
];

const VISA_PIPELINE_STAGES = [
  { id: 'Doc Collection', name: 'Document Collection', color: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400', order: 0 },
  { id: 'Apostille', name: 'Apostille/Verification', color: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400', order: 1 },
  { id: 'Embassy Submission', name: 'Embassy Submission', color: 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400', order: 2 },
  { id: 'Visa Issued', name: 'Visa Issued', color: 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400', order: 3 },
  { id: 'Flyer/Pre-departure', name: 'Flyer/Pre-departure', color: 'bg-teal-500/10 border-teal-500/30 text-teal-600 dark:text-teal-400', order: 4 }
];

const DEFAULT_SETTINGS = {
  company_name: 'Perfect Scholar Lead Management',
  admission_year_prefix: '2026',
  lead_assignment_rule: 'round-robin',
  routing_budget_threshold: 40,
  meta_verify_token: 'edupath_crm_verify_token_xyz',
  meta_access_token: '',
  fb_pages: [],
  whatsapp_phone_id: '109827364583920',
  whatsapp_account_id: '120938475647382',
  whatsapp_api_token: 'EAAG...whatsapp...token',
  whatsapp_auto_response_template: 'welcome',
  form_integration_strategy: 'fixed',
  form_integration_fixed_course: 'MBBS',
  form_integration_dynamic_field: 'course',
  pipeline_stages: DEFAULT_PIPELINE_STAGES,
  tenant_id: 'default'
};

async function main() {
  console.log("=== SEEDING DEFAULT TENANT ===");

  // 1. Seed settings if missing
  const { data: existingSettings, error: errSet } = await supabase
    .from('settings')
    .select('*')
    .eq('tenant_id', 'default')
    .maybeSingle();

  if (errSet) {
    console.error("Error checking settings:", errSet);
  } else if (!existingSettings) {
    console.log("Seeding settings for 'default' tenant...");
    const { error: errSetIns } = await supabase.from('settings').insert([DEFAULT_SETTINGS]);
    if (errSetIns) console.error("Error inserting settings:", errSetIns);
  } else {
    console.log("Settings already exist for 'default' tenant.");
  }

  // 2. Seed Sales Pipeline
  let salesPipeId = null;
  const { data: existingSales, error: errSales } = await supabase
    .from('pipelines')
    .select('id')
    .eq('tenant_id', 'default')
    .eq('name', 'Sales Pipeline')
    .maybeSingle();

  if (errSales) {
    console.error("Error checking Sales Pipeline:", errSales);
  } else if (!existingSales) {
    console.log("Seeding Sales Pipeline...");
    const { data: inserted, error: errSalesIns } = await supabase
      .from('pipelines')
      .insert([{
        name: 'Sales Pipeline',
        stages: DEFAULT_PIPELINE_STAGES,
        tenant_id: 'default',
        is_default: true
      }])
      .select()
      .single();
    if (errSalesIns) {
      console.error("Error inserting Sales Pipeline:", errSalesIns);
    } else {
      salesPipeId = inserted.id;
      console.log("Seeding Sales Pipeline successful, ID:", salesPipeId);
    }
  } else {
    salesPipeId = existingSales.id;
    console.log("Sales Pipeline already exists, ID:", salesPipeId);
  }

  // 3. Seed Visa Pipeline
  let visaPipeId = null;
  const { data: existingVisa, error: errVisa } = await supabase
    .from('pipelines')
    .select('id')
    .eq('tenant_id', 'default')
    .eq('name', 'Visa/Post-Closing Pipeline')
    .maybeSingle();

  if (errVisa) {
    console.error("Error checking Visa Pipeline:", errVisa);
  } else if (!existingVisa) {
    console.log("Seeding Visa Pipeline...");
    const { data: inserted, error: errVisaIns } = await supabase
      .from('pipelines')
      .insert([{
        name: 'Visa/Post-Closing Pipeline',
        stages: VISA_PIPELINE_STAGES,
        tenant_id: 'default',
        is_default: false
      }])
      .select()
      .single();
    if (errVisaIns) {
      console.error("Error inserting Visa Pipeline:", errVisaIns);
    } else {
      visaPipeId = inserted.id;
      console.log("Seeding Visa Pipeline successful, ID:", visaPipeId);
    }
  } else {
    visaPipeId = existingVisa.id;
    console.log("Visa Pipeline already exists, ID:", visaPipeId);
  }

  // 4. Grant access to all profiles for 'default' tenant
  const { data: profiles, error: errProf } = await supabase
    .from('profiles')
    .select('id')
    .eq('tenant_id', 'default');

  if (errProf) {
    console.error("Error fetching profiles:", errProf);
    return;
  }

  console.log(`Found ${profiles.length} profiles to map.`);
  for (const prof of profiles) {
    if (salesPipeId) {
      const { error: errAccSales } = await supabase
        .from('pipeline_access')
        .insert([{
          pipeline_id: salesPipeId,
          profile_id: prof.id,
          tenant_id: 'default'
        }], { onConflict: 'pipeline_id,profile_id' });
      if (errAccSales) {
        console.error(`Error mapping Sales access for profile ${prof.id}:`, errAccSales.message);
      } else {
        console.log(`Mapped Sales Pipeline access for profile ${prof.id}`);
      }
    }

    if (visaPipeId) {
      const { error: errAccVisa } = await supabase
        .from('pipeline_access')
        .insert([{
          pipeline_id: visaPipeId,
          profile_id: prof.id,
          tenant_id: 'default'
        }], { onConflict: 'pipeline_id,profile_id' });
      if (errAccVisa) {
        console.error(`Error mapping Visa access for profile ${prof.id}:`, errAccVisa.message);
      } else {
        console.log(`Mapped Visa Pipeline access for profile ${prof.id}`);
      }
    }
  }

  console.log("Seeding complete!");
}

main();
