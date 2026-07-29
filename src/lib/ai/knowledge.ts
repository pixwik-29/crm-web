import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export interface CollegeKnowledge {
  id: string;
  name: string;
  country: string;
  city?: string;
  tuition_range?: string;
  yearly_tuition_fee?: string;
  hostel_fee?: string;
  one_time_fee?: string;
  trc_fee?: string;
  processing_fee?: string;
  custom_fees?: any[];
  duration?: string;
  intake?: string;
  eligibility?: string;
  overview?: string;
  admission_process?: string[];
  required_docs?: string[];
  scope?: string;
  course_types?: string[];
  courses?: any[];
}

let cachedKnowledge: string = '';
let lastFetchTime: number = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

/**
 * Fetches all college profiles from partner_colleges table in Supabase 
 * and formats them into a structured RAG knowledge text block for the AI system prompt.
 */
export async function getDatabaseKnowledgeContext(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && cachedKnowledge && (now - lastFetchTime < CACHE_TTL_MS)) {
    return cachedKnowledge;
  }

  if (!supabaseUrl || !serviceKey) {
    return 'University database is currently unavailable.';
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: colleges, error } = await supabase
      .from('partner_colleges')
      .select('*')
      .order('name', { ascending: true });

    if (error || !colleges || colleges.length === 0) {
      console.warn('[AI Knowledge] Warning fetching partner_colleges:', error?.message);
      return cachedKnowledge || 'No college data currently found in database.';
    }

    const lines: string[] = [];
    lines.push('=== PERFECT SCHOLAR UNIVERSITY & MEDICAL COLLEGE DATABASE KNOWLEDGE ===\n');

    colleges.forEach((c: CollegeKnowledge, idx: number) => {
      lines.push(`${idx + 1}. ${c.name} (${c.country}${c.city ? ', ' + c.city : ''})`);
      lines.push(`   • Course Types / Degrees: ${c.course_types?.join(', ') || 'MBBS / General Medicine'}`);
      lines.push(`   • Duration: ${c.duration || '6 Years'}`);
      lines.push(`   • Yearly Tuition Fee: ${c.yearly_tuition_fee || c.tuition_range || 'Contact Counselor'}`);
      lines.push(`   • Hostel / Living Cost: ${c.hostel_fee || 'Varies by accommodation'}`);
      if (c.one_time_fee) lines.push(`   • One-time Admission Fee: ${c.one_time_fee}`);
      if (c.trc_fee && c.trc_fee.toUpperCase() !== 'N/A' && c.trc_fee !== '0') lines.push(`   • TRC & Residence Visa Fee: ${c.trc_fee}`);
      if (c.processing_fee && c.processing_fee !== '0') lines.push(`   • Processing Fee: ${c.processing_fee}`);

      // Custom Fees
      const customFeesList = Array.isArray(c.custom_fees) ? c.custom_fees : (typeof c.custom_fees === 'string' ? JSON.parse(c.custom_fees || '[]') : []);
      if (customFeesList.length > 0) {
        const customStr = customFeesList.map((cf: any) => `${cf.name}: ${cf.amount}`).join('; ');
        lines.push(`   • Custom / Additional Fee Breakdown: ${customStr}`);
      }

      if (c.intake) lines.push(`   • Intake Period: ${c.intake}`);
      if (c.eligibility) lines.push(`   • Eligibility Criteria: ${c.eligibility}`);
      if (c.overview) lines.push(`   • University Overview: ${c.overview}`);

      if (c.admission_process && c.admission_process.length > 0) {
        lines.push(`   • Admission Steps: ${c.admission_process.join(' → ')}`);
      }
      if (c.required_docs && c.required_docs.length > 0) {
        lines.push(`   • Required Documents: ${c.required_docs.join(', ')}`);
      }

      // Individual Courses if available
      if (c.courses && c.courses.length > 0) {
        c.courses.forEach((crs: any) => {
          if (crs.name || crs.course_type) {
            lines.push(`     - Course: ${crs.name || crs.course_type} | Tuition: ${crs.yearly_tuition_fee || crs.tuition_range || c.yearly_tuition_fee || 'N/A'} | Duration: ${crs.duration || c.duration}`);
          }
        });
      }

      lines.push(''); // Blank line between colleges
    });

    cachedKnowledge = lines.join('\n');
    lastFetchTime = now;
    return cachedKnowledge;
  } catch (err: any) {
    console.error('[AI Knowledge] Error loading database knowledge:', err.message);
    return cachedKnowledge || 'University database connection error.';
  }
}
