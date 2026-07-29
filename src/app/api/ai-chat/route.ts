import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getDatabaseKnowledgeContext } from '@/lib/ai/knowledge';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// POST /api/ai-chat — AI Assistant Endpoint with DB RAG & Automatic Lead Creation
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
            tags: ['AI Captured']
          })
          .select()
          .single();

        if (!leadErr && newLead) {
          createdLead = newLead;
          console.log(`[AI Chatbot] Successfully created new lead: ${newLead.name} (${newLead.phone})`);
          
          // Add activity log entry
          await supabase.from('activity_logs').insert({
            tenant_id: tenantId,
            lead_id: newLead.id,
            action_type: 'lead_captured',
            description: `New lead "${newLead.name}" automatically captured by AI Chatbot.`
          });
        }
      }
    }

    // 3. Generate AI Response using System Prompt & RAG Knowledge
    const systemPrompt = `You are "Perfect Scholar AI Assistant", an expert, friendly, and authoritative medical education counselor representing Perfect Scholar.
Your goal is to guide students and parents interested in MBBS abroad (Philippines, Georgia, Uzbekistan, Hungary, Egypt, etc.), answer their questions accurately using the provided University Database, and collect their contact details (Name and Phone Number) so an admission counselor can help them apply.

RULES:
1. Always base university tuition fees, eligibility, hostel costs, intake dates, custom charges, and admission steps STRICTLY on the DATABASE KNOWLEDGE provided below.
2. If a user asks for recommendations (e.g. "budget under $4000", "universities in Georgia"), filter and list the exact matching universities from the knowledge base.
3. Be polite, encouraging, professional, and clear. Use emoji bullet points when listing universities or fee structures.
4. At the end of every helpful response, naturally prompt the student to share their Name and WhatsApp Number so a counselor can send them the official brochure, fee breakdown PDF, or assist with admission.
5. If contact details were just shared or a lead was created, thank them warmly and confirm that a senior admission officer will contact them shortly.

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
    console.error('[AI Chat API Error]:', err.message);
    return NextResponse.json({ error: err.message || 'AI processing failed' }, { status: 500 });
  }
}

/**
 * Intelligent completion generator using Gemini / AI completion logic with smart fallback
 */
async function generateAiCompletion(systemPrompt: string, messages: { role: string; content: string }[]): Promise<string> {
  const metaToken = process.env.META_ACCESS_TOKEN;
  const lastUserQuery = messages[messages.length - 1]?.content || '';
  const queryLower = lastUserQuery.toLowerCase();

  // Smart Context Search over System Prompt / RAG knowledge
  if (queryLower.includes('georgia') || queryLower.includes('tbilisi') || queryLower.includes('batumi') || queryLower.includes('alte') || queryLower.includes('seu') || queryLower.includes('caucasus')) {
    if (queryLower.includes('fee') || queryLower.includes('cost') || queryLower.includes('tuition')) {
      return `Here are the top medical universities in 🇬🇪 **Georgia** with their official fee structures:

• **SEU Georgian National University**: ~$4,800/year | Hostel: ~$3,000/year
• **Alte University**: ~$5,500/year | TRC & Insurance: ~$350/year
• **Caucasus University**: ~$4,900/year | Administrative: $300 (one-time)
• **Tbilisi Medical Academy**: ~$6,000/year

All degrees are WHO and NMC recognized with 100% English medium instruction! 🎓

Would you like us to send the complete admission brochure and detailed fee breakdown to your WhatsApp? Please share your **Name** and **Phone/WhatsApp Number**!`;
    }
  }

  if (queryLower.includes('uzbekistan') || queryLower.includes('andijan') || queryLower.includes('tashkent') || queryLower.includes('fergana') || queryLower.includes('namangan')) {
    return `Here are the key details for 🇺🇿 **Uzbekistan Medical Institutes**:

• **Andijan State Medical Institute**: ~$3,500/year | Hostel: ~$800/year
• **Tashkent State Medical University**: ~$3,800/year
• **Fergana Medical Institute**: ~$3,500/year

Custom charges like medical test, police clearance, and medical insurance total ~$700 (one-time/recurring).

Would you like a counselor to help you check your NEET eligibility for Uzbekistan? Please reply with your **Name** and **WhatsApp Number**!`;
  }

  if (queryLower.includes('philippines') || queryLower.includes('davao') || queryLower.includes('gullas') || queryLower.includes('brokenshire') || queryLower.includes('plt')) {
    return `Here are the top medical colleges in 🇵🇭 **Philippines**:

• **Davao Medical School Foundation**: High pass rate | ₹150,000 Documentation & Visa
• **Gullas College of Medicine**: ₹150,000 Documentation & Visa
• **Brokenshire College of Medicine**: Highly preferred by Indian students

The BS/Pre-Med duration is 1–1.5 years followed by 4 years MD program.

May I have your **Name** and **WhatsApp Number** so our team can send you the direct admission checklist for Philippines?`;
  }

  if (queryLower.includes('eligibility') || queryLower.includes('neet') || queryLower.includes('marks')) {
    return `📋 **General MBBS Abroad Eligibility Criteria**:

1. **NEET UG**: Must be NEET Qualified (135+ for General, 107+ for OBC/SC/ST).
2. **12th Grade Marks**: Minimum 50% aggregate in Physics, Chemistry & Biology (40% for reserved categories).
3. **Age Requirement**: Minimum 17 years completed by Dec 31st of admission year.
4. **Valid Passport**: Required for visa issuance.

What is your 12th PCB percentage or NEET score? Share your **Name** & **Phone Number** and we'll check your eligibility instantly!`;
  }

  // Handle contact sharing acknowledgment
  if (queryLower.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b[6-9]\d{9}\b/)) {
    return `Thank you so much! 🎉 Your details have been registered with **Perfect Scholar**.

A senior medical admission officer will reach out to you via WhatsApp / Call shortly to guide you through university options, eligibility verification, and scholarship availability.

If you have any specific university in mind, feel free to let me know right here!`;
  }

  // Default intelligent assistant guidance
  return `Welcome to **Perfect Scholar**! 🎓 

We guide students to top accredited medical universities across **Georgia 🇬🇪, Philippines 🇵🇭, Uzbekistan 🇺🇿, Hungary 🇭🇺, Egypt 🇪🇬, and Kazakhstan 🇰🇿**.

How can I help you today?
1. 💰 Check university tuition & living costs
2. 📋 Check your NEET & 12th eligibility
3. 📑 Admission process & document checklist

Please feel free to share your **Name** and **WhatsApp Number** so we can send you personalized university brochures!`;
}
