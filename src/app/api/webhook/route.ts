import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { waitUntil } from '@vercel/functions';
import nodemailer from 'nodemailer';

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
        // Also pass the tenant_id from the webhook payload if present (for multi-tenant Meta setups)
        const tenantIdFromPayload = body.tenant_id || 'default';
        waitUntil(processMetaLead({ leadgenId, formId, pageId, adId, tenantId: tenantIdFromPayload }));

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
      landing_page_url,
      external_consultant,
      tenant_id = 'default'
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
      tags: ['Webhook Ingestion'],
      external_consultant: external_consultant || null,
      tenant_id
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
        description: `Lead auto-captured via Webhook from ${lead_source}. Campaign: ${campaign_name || 'N/A'}`,
        tenant_id: data.tenant_id
      }]);

      // Trigger background email and push notifications
      waitUntil(sendNewLeadNotifications(data));

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
async function processMetaLead({ leadgenId, formId, pageId, adId, tenantId = 'default' }: {
  leadgenId: string;
  formId?: string;
  pageId?: string;
  adId?: string;
  tenantId?: string;
}) {
  console.log(`[processMetaLead] Starting background processing for leadgen_id=${leadgenId}, tenant=${tenantId}`);

  // Resolve Meta Access Token: first check tenant's database settings, then fall back to env var
  let metaAccessToken = process.env.META_ACCESS_TOKEN;
  if (supabase) {
    const { data: tenantSettings } = await supabase
      .from('settings')
      .select('meta_access_token')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (tenantSettings?.meta_access_token) {
      metaAccessToken = tenantSettings.meta_access_token;
      console.log(`[processMetaLead] Using tenant-specific Meta token for tenant: ${tenantId}`);
    } else {
      console.log(`[processMetaLead] No tenant token found for ${tenantId}, using global env token.`);
    }
  }

  let leadPayload: any;

  if (!metaAccessToken) {
    console.warn('[processMetaLead] No META_ACCESS_TOKEN configured (env or tenant DB), using fallback mock lead');
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
        const external_consultant = extractField(fieldData, ['external_consultant', 'consultant', 'partner', 'agency']);

        console.log(`[processMetaLead] Parsed fields: name="${name}", phone="${phone}", email="${email}", consultant="${external_consultant}"`);
        
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
          tags: ['Facebook Lead Ads'],
          external_consultant: external_consultant || null
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

  if (leadPayload) {
    leadPayload.tenant_id = tenantId;
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
      description: `Lead auto-captured from Facebook Ads. LeadGen ID: ${leadgenId}. Ad ID: ${adId || 'N/A'}`,
      tenant_id: data.tenant_id
    }]);
    
    console.log('[processMetaLead] Activity log created.');

    // Trigger email and push notifications for Meta Leads
    await sendNewLeadNotifications(data);
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

// Sends both Email notifications (Zoho SMTP) and Mobile Push notifications (Expo Push API) for new leads
async function sendNewLeadNotifications(lead: any) {
  try {
    if (!supabase) {
      console.log('[Notifications] Supabase not configured. Skipping notifications.');
      return;
    }
    console.log('[Notifications] Starting notification dispatch for lead:', lead.id);

    // 1. Fetch all admins, managers, and assigned counselors belonging to the same tenant
    const { data: recipients, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, push_token, role')
      .eq('tenant_id', lead.tenant_id || 'default')
      .or(`role.eq.admin,role.eq.manager${lead.assigned_counsellor_id ? `,id.eq.${lead.assigned_counsellor_id}` : ''}`);

    if (error) {
      console.error('[Notifications] Error fetching notification recipients:', error.message);
      return;
    }

    if (!recipients || recipients.length === 0) {
      console.log('[Notifications] No admin, manager, or assigned counselor recipients found.');
      return;
    }

    // 2. Load auth users to retrieve their email addresses (emails are not in the profiles table)
    const { data: authUsers, error: authUsersError } = await supabase.auth.admin.listUsers();
    if (authUsersError) {
      console.error('[Notifications] Failed to retrieve auth user emails:', authUsersError.message);
    }

    const emailsToSend: string[] = ['nash@pixwik.com', 'crm@perfectscholar.com']; // default fallback / admin emails

    if (authUsers && authUsers.users) {
      recipients.forEach(prof => {
        const matchingUser = authUsers.users.find(u => u.id === prof.id);
        if (matchingUser && matchingUser.email && !emailsToSend.includes(matchingUser.email)) {
          emailsToSend.push(matchingUser.email);
        }
      });
    }

    // 3. Build email notification body
    const subject = `🔥 New Lead Captured: ${lead.name}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1a202c;">
        <div style="text-align: center; margin-bottom: 25px;">
          <h2 style="color: #4f46e5; margin: 0; font-size: 24px; font-weight: 800; tracking-tight;">Perfect Scholar CRM</h2>
          <span style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #a0aec0; letter-spacing: 1.5px; display: block; margin-top: 5px;">New Ingestion Alert</span>
        </div>
        
        <p style="font-size: 15px; line-height: 1.6; color: #4a5568;">Hello Team, a new candidate inquiry has been successfully captured in the lead management database.</p>
        
        <div style="background-color: #f7fafc; padding: 20px; border-radius: 12px; margin: 25px 0; border: 1px dashed #e2e8f0;">
          <table style="width: 100%; font-size: 14px; line-height: 1.5;">
            <tr>
              <td style="font-weight: bold; color: #718096; padding: 8px 0; width: 150px; vertical-align: top;">Candidate Name</td>
              <td style="color: #2d3748; padding: 8px 0; font-weight: bold;">${lead.name}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; color: #718096; padding: 8px 0; vertical-align: top;">Contact Phone</td>
              <td style="color: #2d3748; padding: 8px 0;">${lead.phone}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; color: #718096; padding: 8px 0; vertical-align: top;">Email Address</td>
              <td style="color: #2d3748; padding: 8px 0;">${lead.email || 'N/A'}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; color: #718096; padding: 8px 0; vertical-align: top;">NEET Score</td>
              <td style="color: #2d3748; padding: 8px 0; font-weight: bold; color: #38a169;">${lead.neet_marks || 'N/A'}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; color: #718096; padding: 8px 0; vertical-align: top;">Destination</td>
              <td style="color: #2d3748; padding: 8px 0;">${lead.preferred_destination || 'N/A'}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; color: #718096; padding: 8px 0; vertical-align: top;">Budget Limit</td>
              <td style="color: #2d3748; padding: 8px 0;">${lead.budget ? `\u20B9${Number(lead.budget).toLocaleString('en-IN')}` : 'N/A'}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; color: #718096; padding: 8px 0; vertical-align: top;">Lead Source</td>
              <td style="color: #4f46e5; padding: 8px 0; font-weight: bold;">${lead.lead_source}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; color: #718096; padding: 8px 0; vertical-align: top;">Campaign</td>
              <td style="color: #2d3748; padding: 8px 0; font-style: italic;">${lead.campaign_name || 'Organic'}</td>
            </tr>
          </table>
        </div>
        
        <p style="font-size: 14px; color: #4a5568; line-height: 1.5; margin-bottom: 25px;">Please access your counselors' dashboard to review details and follow up with the candidate immediately.</p>
        
        <div style="text-align: center; margin-top: 30px; border-top: 1px solid #edf2f7; padding-top: 20px; font-size: 11px; color: #a0aec0;">
          This email was auto-generated by the Perfect Scholar Lead Ingestion Webhook.
        </div>
      </div>
    `;

    // 4. Send SMTP Emails via Nodemailer using configured environment variables
    const host = process.env.SMTP_HOST || 'smtp.zoho.in';
    const port = parseInt(process.env.SMTP_PORT || '465');
    const smtpUser = process.env.SMTP_USER || 'crm@perfectscholar.com';
    const smtpPass = process.env.SMTP_PASS || 'jRpSPCnq9pUa';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 5000, // Fail fast to prevent locking Vercel function
      greetingTimeout: 5000,
      socketTimeout: 5000
    });

    const emailPromises = emailsToSend.map(async (toEmail) => {
      try {
        await transporter.sendMail({
          from: `"Perfect Scholar CRM" <${smtpUser}>`,
          to: toEmail,
          subject,
          html: emailHtml
        });
        console.log(`[Notifications] Successfully sent email notification to ${toEmail}`);
      } catch (err: any) {
        console.error(`[Notifications] Failed to send email to ${toEmail}:`, err.message);
      }
    });

    // 5. Send Expo Mobile Push Notifications
    const pushPromise = (async () => {
      const pushTokens = recipients
        .map(r => r.push_token)
        .filter((t): t is string => !!t && (t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken')));

      if (pushTokens.length > 0) {
        console.log(`[Notifications] Dispatched Expo Push notifications to:`, pushTokens);
        const pushMessages = pushTokens.map(token => ({
          to: token,
          sound: 'default',
          title: '\uD83D\uDD25 New Lead Ingested!',
          body: `${lead.name} - NEET: ${lead.neet_marks || 'N/A'} - ${lead.lead_source}`,
          data: { leadId: lead.id }
        }));

        try {
          const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pushMessages)
          });
          const data = await response.json();
          console.log('[Notifications] Expo Push Notification Delivery Log:', JSON.stringify(data));
        } catch (pushErr: any) {
          console.error('[Notifications] Failed to send push notification:', pushErr.message);
        }
      } else {
        console.log('[Notifications] No valid Expo Push Tokens found for recipients.');
      }
    })();

    // Await all notification channels concurrently
    await Promise.all([...emailPromises, pushPromise]);
    console.log('[Notifications] All notification dispatches completed.');

  } catch (err: any) {
    console.error('[Notifications] General error in sendNewLeadNotifications:', err.message);
  }
}
