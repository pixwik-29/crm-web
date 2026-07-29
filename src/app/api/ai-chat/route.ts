import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getDatabaseKnowledgeContext } from '@/lib/ai/knowledge';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// POST /api/ai-chat — AI Assistant (Chitra) Endpoint with RAG & Automatic Lead Creation
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      messages = [], 
      visitorInfo = {}, 
      tenantId = 'nash-pixwik-admin',
      channel = 'web' // 'web' | 'whatsapp'
    } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'Message history is required' }, { status: 400 });
    }

    const lastUserMessage = messages[messages.length - 1]?.content || '';
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Retrieve Knowledge Context from Database
    const dbKnowledge = await getDatabaseKnowledgeContext();

    // 2. Perform automated lead extraction check from conversation history
    let createdLead: any = null;
    const fullConversationText = messages.map((m: any) => `${m.role}: ${m.content}`).join('\n');
    
    // Attempt to extract contact info (phone number, name, email, preferred destination)
    const phoneMatch = fullConversationText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b[6-9]\d{9}\b/g);
    const emailMatch = fullConversationText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);

    if (phoneMatch && phoneMatch.length > 0) {
      const extractedPhone = phoneMatch[phoneMatch.length - 1].replace(/\D/g, '');
      
      // Check if lead with this phone already exists to avoid duplicates
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id, name')
        .eq('phone', extractedPhone)
        .maybeSingle();

      if (!existingLead && extractedPhone.length >= 10) {
        // Extract candidate name if available
        let extractedName = visitorInfo.name || '';
        if (!extractedName) {
          const nameMatch = lastUserMessage.match(/(?:my name is|i am|this is|myself|call me)\s+([A-Za-z\s]{2,30})/i);
          if (nameMatch) {
            extractedName = nameMatch[1].trim();
          } else {
            extractedName = `Prospect (${extractedPhone.slice(-4)})`;
          }
        }

        // Infer course and destination preferences from context
        let preferredDest = visitorInfo.destination || '';
        if (!preferredDest) {
          if (/georgia/i.test(fullConversationText)) preferredDest = 'Georgia';
          else if (/philippines/i.test(fullConversationText)) preferredDest = 'Philippines';
          else if (/uzbekistan/i.test(fullConversationText)) preferredDest = 'Uzbekistan';
          else if (/hungary/i.test(fullConversationText)) preferredDest = 'Hungary';
          else if (/egypt/i.test(fullConversationText)) preferredDest = 'Egypt';
          else if (/russia/i.test(fullConversationText)) preferredDest = 'Russia';
          else if (/kazakhstan/i.test(fullConversationText)) preferredDest = 'Kazakhstan';
          else preferredDest = 'Abroad';
        }

        let course = visitorInfo.course || 'MBBS';
        if (/md/i.test(fullConversationText)) course = 'MD';

        // Save new lead directly into database
        const { data: newLead, error: leadErr } = await supabase
          .from('leads')
          .insert({
            tenant_id: tenantId,
            name: extractedName,
            phone: extractedPhone,
            email: emailMatch ? emailMatch[0] : (visitorInfo.email || null),
            preferred_destination: preferredDest,
            course: course,
            lead_source: channel === 'whatsapp' ? 'WhatsApp AI' : 'AI Chatbot',
            status: 'New Lead',
            score: 40,
            tags: ['AI Captured', 'Chitra Bot']
          })
          .select()
          .single();

        if (!leadErr && newLead) {
          createdLead = newLead;
          console.log(`[Chitra AI Bot] Successfully created new lead: ${newLead.name} (${newLead.phone})`);
          
          // Add activity log entry
          await supabase.from('activity_logs').insert({
            tenant_id: tenantId,
            lead_id: newLead.id,
            action_type: 'lead_captured',
            description: `New lead "${newLead.name}" captured by Chitra (AI Counselor).`
          });
        }
      }
    }

    // 3. System Prompt Persona & Rules for Chitra
    const systemPrompt = `You are "Chitra", a warm, empathetic, expert Senior Admission Counselor at Perfect Scholar.

YOUR PERSONA & MANDATORY COUNSELOR RULES:
1. NAME: Always introduce or refer to yourself as "Chitra, Senior Counselor at Perfect Scholar".
2. TONE: Warm, encouraging, professional, empathetic, and advisory — talk like a real human educational counselor.
3. CONCISE INFORMATION: Do NOT give too much overwhelming information at once. Keep responses concise, brief, and clear.
4. PROCESSING FEE POLICY (CRITICAL RULE): NEVER disclose or mention any processing fee amount or consultancy fee numbers. If the user asks about processing fees, service charges, or consultancy fees, STRICTLY respond: "Our senior admission counselor will call you directly and explain our complete transparent service and processing fee structure in detail."
5. HOW TO CHOOSE SUGGESTIONS: If the student asks how to choose a university or country, provide helpful counselor suggestions (e.g., comparing total budget, WHO/NMC recognition, FMGE passing record, climate, and clinical rotation exposure).
6. LEAD CAPTURE GOAL: Gently ask for the student's Name, WhatsApp Number, and 12th PCB % / NEET score so our senior team can connect with them, send personalized university brochures, and check eligibility.

DATABASE KNOWLEDGE:
${dbKnowledge}`;

    // Generate completion response
    const replyText = await generateAiCompletion(systemPrompt, messages);

    return NextResponse.json({
      success: true,
      reply: replyText,
      leadCreated: !!createdLead,
      leadDetails: createdLead ? { id: createdLead.id, name: createdLead.name } : null
    });
  } catch (err: any) {
    console.error('[Chitra AI Chat API Error]:', err.message);
    return NextResponse.json({ error: err.message || 'AI processing failed' }, { status: 500 });
  }
}

/**
 * Intelligent completion generator for Chitra Counselor persona
 */
async function generateAiCompletion(systemPrompt: string, messages: { role: string; content: string }[]): Promise<string> {
  const lastUserQuery = messages[messages.length - 1]?.content || '';
  const queryLower = lastUserQuery.toLowerCase();

  // RULE: STRICT PROCESSING FEE DISCLOSURE BLOCK
  if (queryLower.includes('processing') || queryLower.includes('service fee') || queryLower.includes('consultancy fee') || queryLower.includes('your fee') || queryLower.includes('charge') || queryLower.includes('commission')) {
    return `Hello! 😊 Our senior admission counselor will call you directly and explain our complete transparent service and processing fee structure in detail. 

Could you please share your **Name** and **WhatsApp Number** so I can arrange a quick call with our team?`;
  }

  // RULE: HOW TO CHOOSE UNIVERSITY / COUNTRY SUGGESTIONS
  if (queryLower.includes('how to choose') || queryLower.includes('how do i select') || queryLower.includes('which country is best') || queryLower.includes('which college is best') || queryLower.includes('suggest me') || queryLower.includes('how to decide')) {
    return `Choosing the right medical university is a crucial decision! As a counselor, here are the key factors I recommend keeping in mind:

1. **Recognition**: Ensure the university is listed with **WHO, NMC (India), and ECFMG (USA)**.
2. **Total Budget**: Balance annual tuition with living expenses & hostel fees over the 6-year duration.
3. **FMGE / NExT Passing Rate**: Look for universities with strong academic track records for Indian students.
4. **Clinical Exposure**: Choose universities with multi-specialty affiliated teaching hospitals.

What is your approximate budget and 12th PCB percentage? If you share your **Name** and **WhatsApp Number**, I will have our senior team shortlist the top 3 matching universities for you!`;
  }

  // COUNTRY SPECS — Concise Counselor Responses
  if (queryLower.includes('georgia') || queryLower.includes('tbilisi') || queryLower.includes('batumi') || queryLower.includes('alte') || queryLower.includes('seu')) {
    return `🇬🇪 **Georgia** is one of our top recommendations! Universities like **SEU Georgian National University** (~$4,800/yr) and **Alte University** (~$5,500/yr) offer 100% English medium courses with European standards.

Rather than overwhelming you with data, I can have our team send the complete fee structure & syllabus to your WhatsApp. 

May I know your **Name** and **WhatsApp Number**?`;
  }

  if (queryLower.includes('uzbekistan') || queryLower.includes('andijan') || queryLower.includes('tashkent') || queryLower.includes('fergana')) {
    return `🇺🇿 **Uzbekistan** offers excellent government medical institutes like **Andijan State Medical Institute** (~$3,500/yr) and **Tashkent State Medical University** (~$3,800/yr) with affordable living costs.

Would you like us to check your NEET eligibility for Uzbekistan? Please share your **Name** and **WhatsApp Number**!`;
  }

  if (queryLower.includes('philippines') || queryLower.includes('davao') || queryLower.includes('gullas') || queryLower.includes('brokenshire')) {
    return `🇵🇭 **Philippines** is renowned for its American-pattern MD curriculum and high FMGE passing rate! Colleges like **Davao Medical School Foundation** and **Gullas College of Medicine** are top choices.

Share your **Name** & **WhatsApp Number**, and our senior counselor will send you the direct admission checklist for Philippines!`;
  }

  if (queryLower.includes('eligibility') || queryLower.includes('neet') || queryLower.includes('marks')) {
    return `📋 **General MBBS Abroad Eligibility**:
• **NEET UG**: Must be NEET qualified (135+ for General, 107+ for OBC/SC/ST).
• **12th PCB**: Minimum 50% aggregate in Physics, Chemistry & Biology.
• **Age**: 17+ years.

What is your 12th PCB percentage or NEET score? Please share your **Name** & **Phone Number** so we can verify your eligibility!`;
  }

  // Contact Info Acknowledgment
  if (queryLower.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b[6-9]\d{9}\b/)) {
    return `Thank you so much! 🎉 I have noted your details. 

I am Chitra, and I am assigning one of our senior medical admission counselors to connect with you on WhatsApp / Call shortly to guide you step-by-step and send official brochures.

Feel free to ask if you have any immediate questions in the meantime!`;
  }

  // Default Counselor Welcome
  return `Hello! 👋 I'm **Chitra**, Senior Counselor at Perfect Scholar. 

I help students and parents find the best accredited MBBS abroad options in **Georgia, Philippines, Uzbekistan, Hungary, and Egypt**.

How can I help guide you today?
• Ask for university suggestions based on your budget
• Check your NEET & 12th eligibility
• Get guidance on how to choose the right country

Please feel free to share your **Name** and **WhatsApp Number** so I can arrange a personalized counseling session for you!`;
}
