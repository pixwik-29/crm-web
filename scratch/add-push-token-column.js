const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gkayyfwadwwsucpqeefw.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrYXl5ZndhZHd3c3VjcHFlZWZ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg2NzU0MCwiZXhwIjoyMDk1NDQzNTQwfQ.lv3_6tPCKHCwOOwtTFcI-0ERssAzA5O-ErC_A8h87Xw';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("Adding push_token column to profiles table...");
  const { data, error } = await supabase.rpc('exec_sql', {
    query: 'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token TEXT;'
  });

  if (error) {
    console.log("Error running RPC exec_sql. Trying direct schema alteration or checking if column already exists...");
    // If exec_sql RPC is not defined (standard on Supabase), we can create it or query tables.
    // Wait, let us check if we can query using rpc or if it fails.
    console.error("RPC Error Details:", error);
  } else {
    console.log("Successfully altered table!", data);
  }
}

run();
