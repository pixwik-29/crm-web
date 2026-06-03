const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gkayyfwadwwsucpqeefw.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrYXl5ZndhZHd3c3VjcHFlZWZ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg2NzU0MCwiZXhwIjoyMDk1NDQzNTQwfQ.lv3_6tPCKHCwOOwtTFcI-0ERssAzA5O-ErC_A8h87Xw';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("Altering whatsapp_templates table to add attachment_url and attachment_name columns...");
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS attachment_url TEXT;
      ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS attachment_name TEXT;
    `
  });

  if (error) {
    console.error("RPC Error Details:", error);
  } else {
    console.log("Successfully altered table!", data);
  }
}

run();
