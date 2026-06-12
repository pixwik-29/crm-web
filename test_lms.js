const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = './.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');

async function main() {
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  
  // Login as John
  const { data: session, error: loginErr } = await anonClient.auth.signInWithPassword({
    email: 'john@elite.com',
    password: 'partner_default_pass_123'
  });
  
  if (loginErr) {
    console.error('❌ Login failed:', loginErr.message);
    return;
  }
  console.log('✅ Logged in as john@elite.com');

  // Test upsert LMS progress (simulating quiz completion)
  const courseId = 'course-1';
  const percentage = 100;
  
  console.log('\n--- Testing LMS Progress Upsert ---');
  const { error: upsertErr } = await anonClient
    .from('partner_lms_progress')
    .upsert({
      user_id: session.user.id,
      course_id: courseId,
      modules_completed: ['module-1', 'module-2'],
      quiz_score: percentage,
      is_completed: true,
      completed_at: new Date().toISOString()
    });
  
  if (upsertErr) {
    console.error('❌ LMS Progress upsert failed:', upsertErr.message, upsertErr.code);
  } else {
    console.log(`✅ LMS progress upserted for course ${courseId} with score ${percentage}%`);
  }

  // Test LMS Certificate insert (simulating pass)
  if (percentage >= 80) {
    const certCode = `CERT-TEST-${Math.floor(100000 + Math.random() * 900000)}`;
    const { error: certErr } = await anonClient
      .from('partner_lms_certificates')
      .insert([{
        user_id: session.user.id,
        course_id: courseId,
        certificate_code: certCode,
        pdf_url: `/certificates/${certCode}.pdf`
      }]);
    
    if (certErr) {
      console.error('❌ Certificate insert failed:', certErr.message, certErr.code, '(Table may not exist)');
    } else {
      console.log(`✅ Certificate created: ${certCode}`);
    }
  }

  // Read back progress
  const { data: prog, error: readErr } = await anonClient
    .from('partner_lms_progress')
    .select('*')
    .eq('user_id', session.user.id);
  
  if (readErr) {
    console.error('❌ Reading progress failed:', readErr.message);
  } else {
    console.log(`\n✅ Total progress records: ${prog.length}`);
    prog.forEach(p => console.log(`  - ${p.course_id}: score=${p.quiz_score}%, completed=${p.is_completed}`));
  }

  await anonClient.auth.signOut();
}

main();
