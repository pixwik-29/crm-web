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

    colleges.forEach((c: any, idx: number) => {
      const mainCourse = (Array.isArray(c.courses) && c.courses.length > 0) ? c.courses[0] : {};
      const tuitionFee = c.tuition_range || c.yearly_tuition_fee || mainCourse.tuition_range || mainCourse.yearly_tuition_fee || 'Contact Counselor';
      const hostelFee = c.accommodation_fee || c.hostel_fee || mainCourse.accommodation_fee || mainCourse.hostel_fee || 'Varies';
      const hostelFreq = c.accommodation_freq || mainCourse.accommodation_freq || 'yearly';
      const duration = c.duration || mainCourse.duration || '6 Years';

      lines.push(`${idx + 1}. ${c.name} (${c.country}${c.city ? ', ' + c.city : ''})`);
      lines.push(`   • Course / Degree: ${c.course_types?.join(', ') || mainCourse.course_type || 'MBBS / General Medicine'}`);
      lines.push(`   • Duration: ${duration}`);
      lines.push(`   • Yearly Tuition Fee: ${tuitionFee}`);
      lines.push(`   • Hostel / Accommodation Fee: ${hostelFee}${hostelFreq ? ` (${hostelFreq})` : ''}`);
      
      if (mainCourse.bs_fee) {
        lines.push(`   • BS / Pre-Med Upfront Fee: ${mainCourse.bs_fee} (${mainCourse.bs_duration || '1 Year'})`);
      }
      if (c.one_time_fee || mainCourse.one_time_fee) {
        lines.push(`   • One-time Admission Fee: ${c.one_time_fee || mainCourse.one_time_fee}`);
      }
      if (c.trc_fee || mainCourse.trc_fee) {
        const trc = c.trc_fee || mainCourse.trc_fee;
        if (trc && trc.toUpperCase() !== 'N/A' && trc !== '0') {
          lines.push(`   • TRC & Residence Visa Fee: ${trc}`);
        }
      }

      // Custom Fees
      const customFeesList = Array.isArray(c.custom_fees) ? c.custom_fees : (Array.isArray(mainCourse.custom_fees) ? mainCourse.custom_fees : []);
      if (customFeesList.length > 0) {
        const customStr = customFeesList.map((cf: any) => `${cf.name}: ${cf.amount}`).join('; ');
        lines.push(`   • Additional Fee Breakdown: ${customStr}`);
      }

      if (c.intake || mainCourse.intake) lines.push(`   • Intake Period: ${c.intake || mainCourse.intake}`);
      if (c.eligibility || mainCourse.eligibility) lines.push(`   • Eligibility Criteria: ${c.eligibility || mainCourse.eligibility}`);
      if (c.overview || mainCourse.overview) lines.push(`   • University Overview: ${c.overview || mainCourse.overview}`);

      lines.push(''); // Blank line between colleges
    });

    // Append Custom Uploaded Knowledge Base Items (FAQs, Visa Guidelines, Scholarships, Documents)
    try {
      const { fetchCustomKnowledgeItems } = await import('@/app/api/ai-knowledge/route');
      const customItems = await fetchCustomKnowledgeItems();
      if (customItems && customItems.length > 0) {
        lines.push('\n=== ADDITIONAL CUSTOM KNOWLEDGE & FAQS (VISA, SCHOLARSHIPS, POLICIES) ===\n');
        customItems.forEach((item, i) => {
          lines.push(`${i + 1}. [${item.category.toUpperCase()}] ${item.title}`);
          lines.push(`   ${item.content.replace(/\n/g, '\n   ')}`);
          lines.push('');
        });
      }
    } catch (e) {
      console.warn('[AI Knowledge] Could not append custom knowledge items:', e);
    }

    cachedKnowledge = lines.join('\n');
    lastFetchTime = now;
    return cachedKnowledge;
  } catch (err: any) {
    console.error('[AI Knowledge] Error loading database knowledge:', err.message);
    return cachedKnowledge || 'University database connection error.';
  }
}
