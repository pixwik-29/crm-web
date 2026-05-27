import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { waitUntil } from '@vercel/functions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey) 
  : null;

// GET /api/webhook
// Handles verification handshake from Meta/Facebook Webhooks
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const verifyToken = process.env.META_VERIFY_TOKEN || 'perfectscholar_token';

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verified successfully!');
      return new Response(challenge, { status: 200 });
    }

    return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/webhook
// Receives lead alerts from Meta/Facebook Lead Ads, Instagram Forms, Google Ads, or custom Website Webhooks.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[Webhook] Received payload:', JSON.stringify(body));
    
    // 1. Detect if this is a Meta/Facebook Lead Gen webhook payload
    if (body.object === 'page' && body.entry && body.entry.length > 0) {
      const change = body.entry[0].changes?.[0];
      
      if (change && change.field === 'leadgen') {
        const leadgenId = change.value?.leadgen_id;
        const formId = change.value?.form_id;
        const pageId = change.value?.page_id;
        const adId = change.value?.ad_id;
        
        console.log(`[Webhook] Meta leadgen event received. leadgen_id=${leadgenId}, form_id=${formId}, page_id=${pageId}, ad_id=${adId}`);

        if (!leadgenId) {
          console.error('[Webhook] leadgen_id missing from payload');
          return NextResponse.json({ received: true }, { status: 200 });
        }

        // ✅ CRITICAL: Return 200 OK to Meta IMMEDIATELY before any async processing.
        // Meta has a ~5 second timeout. If we don't respond in time, it marks as "Pending".
        // waitUntil runs the processing in the background AFTER the response is sent.
        waitUntil(processMetaLead({ leadgenId, formId, pageId, adId }));

        return NextResponse.json({ received: true }, { status: 200 });
      }
    }
    
    // 2. Direct Webhook Integration payload parsing (e.g. custom landing page or n8n webhook)
    const {
      name,
      phone,
      email,
      parent_contact,
      neet_marks,
      budget,
      preferred_destination,
      course,
      lead_source = 'Webhook Entry',
      campaign_name,
      adset_name,
      creative_name,
      utm_source,
      utm_medium,
      utm_campaign,
      landing_page_url
    } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Bad Request: Name and Phone number are required' }, 
        { status: 400 }
      );
    }

    const marks = neetMarksValue(neet_marks);
    let score = 30;
    if (marks > 450) score = 90;
    else if (marks > 300) score = 65;
    else if (marks > 150) score = 50;

    const leadPayload = {
      name,
      phone,
      email,
      parent_contact,
      neet_marks: marks || null,
      budget: budget ? parseFloat(budget) : null,
      preferred_destination,
      course,
      lead_source,
      campaign_name,
      adset_name,
      creative_name,
      utm_source,
      utm_medium,
      utm_campaign,
      landing_page_url,
      status: '1st followup',
      score,
      tags: ['Webhook Ingestion']
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('leads')
        .insert([leadPayload])
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      await supabase.from('activity_logs').insert([{
        lead_id: data.id,
        action_type: 'lead_created',
        description: `Lead auto-captured via Webhook from ${lead_source}. Campaign: ${campaign_name || 'N/A'}`
      }]);

      return NextResponse.json({ success: true, lead: data }, { status: 201 });
    } else {
      console.log('--- Webhook Mock Ingestion ---');
      console.log(leadPayload);
      
      return NextResponse.json({
        success: true,
        message: 'Mock Mode: Webhook payload parsed and logged successfully. Connect Supabase database to write persistent rows.',
        data: leadPayload
      }, { status: 201 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// Background processor for Meta Lead Ads webhook events
async function processMetaLead({ leadgenId, formId, pageId, adId }: {
  leadgenId: string;
  formId?: string;
  pageId?: string;
  adId?: string;
}) {
  console.log(`[processMetaLead] Starting background processing for leadgen_id=${leadgenId}`);
  
  const metaAccessToken = process.env.META_ACCESS_TOKEN;
  let leadPayload: any;

  if (!metaAccessToken) {
    console.warn('[processMetaLead] META_ACCESS_TOKEN not configured, using fallback mock lead');
    leadPayload = {
      name: `Meta Lead (${leadgenId})`,
      phone: '+919999999999',
      email: 'metalead@perfectscholar.com',
      lead_source: 'Facebook Ads',
      campaign_name: 'Meta Form Integration (Token Missing)',
      status: '1st followup',
      score: 50,
      tags: ['Meta Ingestion', 'Token Missing']
    };
  } else {
    // Fetch lead details from Meta Graph API
    const graphUrl = `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${metaAccessToken}`;
    console.log(`[processMetaLead] Fetching from Graph API: ${graphUrl.replace(metaAccessToken, '***')}`);
    
    try {
      // Strategy 1: Fetch by leadgen_id directly (requires Advanced Access / approved leads_retrieval)
      let fieldData: any[] = [];
      const fbResponse = await fetch(graphUrl);
      const fbText = await fbResponse.text();
      
      if (fbResponse.ok) {
        const fbLeadData = JSON.parse(fbText);
        fieldData = fbLeadData.field_data || [];
        console.log(`[processMetaLead] Strategy 1 (leadgen_id direct) success. Fields: ${fieldData.map((f: any) => f.name).join(', ')}`);
      } else {
        console.warn(`[processMetaLead] Strategy 1 failed (status=${fbResponse.status}). Trying Strategy 2 (form-level fetch)...`);
        
        // Strategy 2: Fetch from form endpoint filtered by leadgen_id (works with page token / Standard Access)
        if (formId) {
          const filterParam = encodeURIComponent(JSON.stringify([{field: 'id', operator: 'EQUAL', value: leadgenId}]));
          const formLeadsUrl = `https://graph.facebook.com/v19.0/${formId}/leads?filtering=${filterParam}&access_token=${metaAccessToken}`;
          console.log(`[processMetaLead] Fetching from form leads endpoint for form ${formId}`);
          
          const formRes = await fetch(formLeadsUrl);
          if (formRes.ok) {
            const formData = await formRes.json();
            const lead = formData.data?.[0];
            if (lead) {
              fieldData = lead.field_data || [];
              console.log(`[processMetaLead] Strategy 2 success. Fields: ${fieldData.map((f: any) => f.name).join(', ')}`);
            } else {
              console.warn(`[processMetaLead] Strategy 2: Lead not found in form results`);
            }
          } else {
            const formErr = await formRes.text();
            console.warn(`[processMetaLead] Strategy 2 failed: ${formErr}`);
          }
        }
      }
      
      if (fieldData.length > 0) {
        const name = extractField(fieldData, ['full_name', 'name', 'first_name', 'last_name']);
        const phone = extractField(fieldData, ['phone_number', 'phone', 'mobile_number', 'contact_number']);
        const email = extractField(fieldData, ['email']);
        const neet_marks = extractField(fieldData, ['neet_marks', 'neet_score', 'neet']);
        const preferred_destination = extractField(fieldData, ['preferred_destination', 'destination', 'country', 'state', 'city']);
        const budget = extractField(fieldData, ['budget', 'fees', 'investment']);

        console.log(`[processMetaLead] Parsed fields: name="${name}", phone="${phone}", email="${email}"`);
        
        const marks = neetMarksValue(neet_marks);
        let score = 30;
        if (marks > 450) score = 90;
        else if (marks > 300) score = 65;
        
        leadPayload = {
          name: name || 'Meta Lead Form User',
          phone: phone || '+910000000000',
          email: email || undefined,
          neet_marks: marks || null,
          budget: budget ? parseFloat(budget.replace(/\D/g, '')) : null,
          preferred_destination: preferred_destination || undefined,
          course: 'MBBS',
          lead_source: 'Facebook Ads',
          campaign_name: `Form ID: ${formId || 'N/A'} (Page ID: ${pageId || 'N/A'})`,
          status: '1st followup',
          score,
          tags: ['Facebook Lead Ads']
        };
      } else {
        // Both strategies failed — insert fallback so lead is never lost
        console.warn('[processMetaLead] Both fetch strategies failed, using fallback mock lead');
        leadPayload = {
          name: `Meta Lead (${leadgenId})`,
          phone: '+910000000000',
          lead_source: 'Facebook Ads',
          campaign_name: `Form ID: ${formId || 'N/A'} (Fetch Failed)`,
          status: '1st followup',
          score: 40,
          tags: ['Facebook Lead Ads', 'Fetch Failed - Check Manually']
        };
      }
    } catch (fetchErr: any) {
      console.error('[processMetaLead] Network error fetching from Graph API:', fetchErr.message);
      leadPayload = {
        name: `Meta Lead (${leadgenId})`,
        phone: '+919999999999',
        lead_source: 'Facebook Ads',
        campaign_name: `Form ID: ${formId || 'N/A'} (Network Error)`,
        status: '1st followup',
        score: 40,
        tags: ['Meta Lead', 'Fetch Error']
      };
    }
  }

  // Insert lead into Supabase
  if (!supabase) {
    console.warn('[processMetaLead] Supabase not configured, cannot insert lead');
    return;
  }

  console.log('[processMetaLead] Inserting lead into Supabase:', JSON.stringify(leadPayload));
  
  try {
    const { data, error } = await supabase.from('leads').insert([leadPayload]).select().single();
    
    if (error) {
      console.error('[processMetaLead] Supabase insert error:', error.message, error.details);
      return;
    }
    
    console.log(`[processMetaLead] ✅ Lead inserted successfully! ID=${data.id}, Name="${data.name}"`);
    
    await supabase.from('activity_logs').insert([{
      lead_id: data.id,
      action_type: 'lead_created',
      description: `Lead auto-captured from Facebook Ads. LeadGen ID: ${leadgenId}. Ad ID: ${adId || 'N/A'}`
    }]);
    
    console.log('[processMetaLead] Activity log created.');
  } catch (dbErr: any) {
    console.error('[processMetaLead] Exception during DB insert:', dbErr.message);
  }
}

// Helpers
function neetMarksValue(val: any): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseInt(val);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function extractField(fieldData: any[], fieldNames: string[]): string {
  const field = fieldData.find(f => fieldNames.includes(f.name.toLowerCase()));
  if (field && field.values && field.values.length > 0) {
    return field.values[0];
  }
  return '';
}
