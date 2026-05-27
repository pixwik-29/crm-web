import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey) 
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
    
    // 1. Detect if this is a Meta/Facebook Lead Gen webhook payload
    if (body.object === 'page' && body.entry && body.entry.length > 0) {
      console.log('Detected Meta Lead Gen Webhook Payload:', JSON.stringify(body));
      
      const change = body.entry[0].changes?.[0];
      if (change && change.field === 'leadgen') {
        const leadgenId = change.value?.leadgen_id;
        const formId = change.value?.form_id;
        const pageId = change.value?.page_id;
        const adId = change.value?.ad_id;
        
        if (!leadgenId) {
          return NextResponse.json({ error: 'Leadgen ID not found in Meta payload' }, { status: 400 });
        }
        
        // Retrieve Meta Access Token from environment variables
        const metaAccessToken = process.env.META_ACCESS_TOKEN;
        if (!metaAccessToken) {
          console.warn('META_ACCESS_TOKEN environment variable not configured. Storing mock lead entry.');
          const mockLead = {
            name: `Meta Lead Form User (ID: ${leadgenId.substring(0, 6)})`,
            phone: '+919999999999',
            email: 'metalead@perfectscholar.com',
            lead_source: 'Facebook Ads',
            campaign_name: 'Meta Form Integration',
            status: '1st followup',
            score: 50,
            tags: ['Meta Ingestion Needed']
          };
          
          if (supabase) {
            const { data } = await supabase.from('leads').insert([mockLead]).select().single();
            await supabase.from('activity_logs').insert([{
              lead_id: data.id,
              action_type: 'lead_created',
              description: 'Meta webhook received, but META_ACCESS_TOKEN is missing. Stored fallback lead.'
            }]);
          }
          return NextResponse.json({ success: true, message: 'Meta webhook received. Configure META_ACCESS_TOKEN to fetch real lead fields.', lead: mockLead }, { status: 201 });
        }
        
        // Call Meta Graph API to fetch lead details
        const graphUrl = `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${metaAccessToken}`;
        const fbResponse = await fetch(graphUrl);
        
        if (!fbResponse.ok) {
          const fbErrText = await fbResponse.text();
          console.error('Meta Graph API retrieval failed:', fbErrText);
          return NextResponse.json({ error: 'Failed to retrieve lead data from Meta Graph API', details: fbErrText }, { status: 502 });
        }
        
        const fbLeadData = await fbResponse.json();
        const fieldData = fbLeadData.field_data || [];
        
        // Extract values using fallback matches
        const name = extractField(fieldData, ['full_name', 'name', 'first_name', 'last_name']);
        const phone = extractField(fieldData, ['phone_number', 'phone', 'mobile_number', 'contact_number']);
        const email = extractField(fieldData, ['email']);
        const neet_marks = extractField(fieldData, ['neet_marks', 'neet_score', 'neet']);
        const preferred_destination = extractField(fieldData, ['preferred_destination', 'destination', 'country', 'state']);
        const budget = extractField(fieldData, ['budget', 'fees', 'investment']);
        
        const marks = neetMarksValue(neet_marks);
        let score = 30;
        if (marks > 450) score = 90;
        else if (marks > 300) score = 65;
        
        const leadPayload = {
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
        
        if (supabase) {
          const { data, error } = await supabase.from('leads').insert([leadPayload]).select().single();
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          
          await supabase.from('activity_logs').insert([{
            lead_id: data.id,
            action_type: 'lead_created',
            description: `Lead auto-captured natively from Facebook Ads Form. Ad ID: ${adId || 'N/A'}`
          }]);
          
          return NextResponse.json({ success: true, lead: data }, { status: 201 });
        } else {
          return NextResponse.json({ success: true, mode: 'Mock Mode', lead: leadPayload }, { status: 201 });
        }
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
