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

function sanitizeWhatsAppText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*/g, '')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{203C}\u{2049}\u{2122}\u{2139}\u{2194}-\u{2199}\u{21A9}-\u{21AA}\u{231A}-\u{231B}\u{2328}\u{23CF}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{24C2}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2600}-\u{2604}\u{260E}\u{2611}\u{2614}-\u{2615}\u{2618}\u{261D}\u{2620}\u{2622}-\u{2623}\u{2626}\u{262A}\u{262E}-\u{262F}\u{2638}-\u{263A}\u{2640}\u{2642}\u{2648}-\u{2653}\u{2660}\u{2663}\u{2665}-\u{2666}\u{2668}\u{267B}\u{267F}\u{2692}-\u{2697}\u{2699}\u{269B}-\u{269C}\u{26A0}-\u{26A1}\u{26AA}-\u{26AB}\u{26B0}-\u{26B1}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26C8}\u{26CE}-\u{26CF}\u{26D1}\u{26D3}-\u{26D4}\u{26E9}-\u{26EA}\u{26F0}-\u{26F5}\u{26F7}-\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}-\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}-\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{27BF}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}]/gu, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

    // 3. System Prompt Persona & Rules for Chitra
    const systemPrompt = `You are "Chitra", a warm, natural, human Senior Admission Counselor at Perfect Scholar.

CRITICAL FORMATTING & STYLE RULES:
1. STRICTLY NO EMOJIS: Do NOT use any emojis, icons, flags, or face symbols anywhere in your response. Absolute zero emojis.
2. STRICTLY NO ASTERISKS OR BOLD MARKDOWN: Do NOT use asterisks (*) or bold markdown formatting anywhere. Write plain text words with standard capitalization. Never write *Georgia*, *SEU*, *NEET*, etc.
3. NATURAL HUMAN COUNSELOR TONE: Speak like a real, friendly human admission counselor chatting on WhatsApp. Keep your responses warm, concise, and natural. Do NOT use bullet points, numbered lists, dash lists, or long structured lectures. Speak in 2-3 natural sentences as if you are typing directly on WhatsApp.
4. ACCURATE DATABASE KNOWLEDGE: Rely strictly on the official database context below for all university tuition fees, living costs, durations, and eligibility details. If a specific detail is missing, offer to have a senior counselor share the complete brochure on WhatsApp.
5. STRICT PROCESSING FEE POLICY: NEVER mention or disclose any processing fee, service fee, or consultancy fee numbers. If asked about processing fees, service charges, or consultancy fees, respond: "Our senior admission counselor will call you directly and explain our complete service and processing fee structure in detail."
6. COUNSELOR GOAL: Gently invite the student to share their name, 12th PCB percentage, or NEET score so you can guide them to the best matching universities.

DATABASE KNOWLEDGE:
${dbKnowledge}`;

    // Generate completion response
    const rawReplyText = await generateAiCompletion(systemPrompt, messages);
    const replyText = sanitizeWhatsAppText(rawReplyText);

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
 * Intelligent completion generator for Chitra Counselor persona using Gemini API with smart fallback
 */
async function generateAiCompletion(systemPrompt: string, messages: { role: string; content: string }[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const lastUserQuery = messages[messages.length - 1]?.content || '';
  const queryLower = lastUserQuery.toLowerCase();

  // RULE 1: STRICT PROCESSING FEE DISCLOSURE BLOCK (Applies ALWAYS)
  if (queryLower.includes('processing') || queryLower.includes('service fee') || queryLower.includes('consultancy fee') || queryLower.includes('your fee') || queryLower.includes('charge') || queryLower.includes('commission')) {
    return `Our senior admission counselor will call you directly and explain our complete transparent service and processing fee structure in detail. Could you please share your Name and WhatsApp Number so I can arrange a quick call with our team?`;
  }

  // Attempt Gemini AI Call if API key is provided
  if (apiKey) {
    const modelsToTry = ['gemini-flash-latest', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
    for (const modelName of modelsToTry) {
      try {
        const contentsPayload: any[] = [
          { role: 'user', parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemPrompt}` }] },
          { role: 'model', parts: [{ text: 'Understood. I am Chitra, Senior Counselor at Perfect Scholar. I will guide the student warmly, concisely, and accurately according to your instructions without emojis and without asterisks.' }] }
        ];

        let lastRole = 'model';
        if (messages && messages.length > 0) {
          for (const m of messages) {
            if (!m.content) continue;
            const msgRole = m.role === 'user' ? 'user' : 'model';
            if (msgRole !== lastRole) {
              contentsPayload.push({
                role: msgRole,
                parts: [{ text: m.content }]
              });
              lastRole = msgRole;
            }
          }
        }

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: contentsPayload })
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim().length > 0) return text;
        }
      } catch (err: any) {
        console.warn(`[Gemini API Call Exception for ${modelName} - Trying fallback]:`, err.message);
      }
    }
  }

  // Smart Fallback Logic for Chitra Counselor Persona (Strictly emoji-free, asterisk-free, natural text)
  if (queryLower.includes('how to choose') || queryLower.includes('how do i select') || queryLower.includes('which country is best') || queryLower.includes('which college is best') || queryLower.includes('suggest me') || queryLower.includes('how to decide')) {
    return `Choosing the right medical university is an important decision. Key factors to compare are WHO and NMC accreditation, annual tuition fees, hostel safety, and hospital clinical exposure. What is your 12th PCB percentage or NEET score? If you share your Name and WhatsApp Number, I will have our senior team shortlist the top 3 matching universities for you.`;
  }

  if (queryLower.includes('georgia') || queryLower.includes('tbilisi') || queryLower.includes('batumi') || queryLower.includes('alte') || queryLower.includes('seu')) {
    return `Georgia is one of our top recommendations for medical studies. Top universities like SEU Georgian National University and Alte University offer 100 percent English medium courses with European standards. Would you like me to have our team send the complete fee structure and eligibility details to your WhatsApp?`;
  }

  if (queryLower.includes('uzbekistan') || queryLower.includes('andijan') || queryLower.includes('tashkent') || queryLower.includes('fergana')) {
    return `Uzbekistan offers government medical institutes like Andijan State Medical Institute and Tashkent State Medical University with affordable tuition and living costs. Would you like us to check your NEET eligibility for Uzbekistan?`;
  }

  if (queryLower.includes('philippines') || queryLower.includes('davao') || queryLower.includes('gullas') || queryLower.includes('brokenshire')) {
    return `The Philippines is renowned for its American pattern MD curriculum and high FMGE passing rates. Colleges like Brokenshire College of Medicine and Davao Medical School Foundation are top choices. Would you like me to send you the direct admission checklist?`;
  }

  if (queryLower.includes('eligibility') || queryLower.includes('neet') || queryLower.includes('marks')) {
    return `For MBBS abroad eligibility, you must be NEET qualified (minimum 135 for General, 107 for Reserved categories) and have at least 50 percent aggregate in 12th Physics, Chemistry, and Biology. What is your 12th PCB percentage or NEET score?`;
  }

  if (queryLower.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b[6-9]\d{9}\b/)) {
    return `Thank you so much! I have noted your details. I am Chitra, and I am assigning one of our senior medical admission counselors to connect with you on WhatsApp or phone call shortly to guide you step by step. Feel free to ask if you have any questions in the meantime.`;
  }

  return `Hello! I am Chitra, Senior Counselor at Perfect Scholar. We assist students with direct admissions to top accredited medical universities in Georgia, Philippines, and Uzbekistan. How can I help guide you today?`;

  return `Hello! 👋 I'm **Chitra**, Senior Counselor at Perfect Scholar. 

I help students and parents find the best accredited MBBS abroad options in **Georgia, Philippines, Uzbekistan, Hungary, and Egypt**.

How can I help guide you today?
• Ask for university suggestions based on your budget
• Check your NEET & 12th eligibility
• Get guidance on how to choose the right country

Please feel free to share your **Name** and **WhatsApp Number** so I can arrange a personalized counseling session for you!`;
}
