import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { waitUntil } from '@vercel/functions';
import nodemailer from 'nodemailer';
import { decryptToken } from '@/lib/messaging/crypto';
import { getDatabaseKnowledgeContext } from '@/lib/ai/knowledge';

function sanitizeWhatsAppText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*/g, '')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{203C}\u{2049}\u{2122}\u{2139}\u{2194}-\u{2199}\u{21A9}-\u{21AA}\u{231A}-\u{231B}\u{2328}\u{23CF}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{24C2}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2600}-\u{2604}\u{260E}\u{2611}\u{2614}-\u{2615}\u{2618}\u{261D}\u{2620}\u{2622}-\u{2623}\u{2626}\u{262A}\u{262E}-\u{262F}\u{2638}-\u{263A}\u{2640}\u{2642}\u{2648}-\u{2653}\u{2660}\u{2663}\u{2665}-\u{2666}\u{2668}\u{267B}\u{267F}\u{2692}-\u{2697}\u{2699}\u{269B}-\u{269C}\u{26A0}-\u{26A1}\u{26AA}-\u{26AB}\u{26B0}-\u{26B1}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26C8}\u{26CE}-\u{26CF}\u{26D1}\u{26D3}-\u{26D4}\u{26E9}-\u{26EA}\u{26F0}-\u{26F5}\u{26F7}-\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}-\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}-\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{27BF}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}]/gu, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

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
    
    // 1. Detect if this is a WhatsApp Webhook payload
    if (body.object === 'whatsapp_business_account' && body.entry && body.entry.length > 0) {
      console.log('[Webhook] WhatsApp webhook event received.');
      const entry = body.entry[0];
      const change = entry.changes?.[0];
      
      if (change) {
        const field = change.field;
        const val = change.value;

        // A. Handle message events (incoming messages or status changes)
        if (field === 'messages') {
          const metadata = val.metadata;
          const phoneId = metadata?.phone_number_id;

          // Resolve tenant_id from settings using whatsapp_phone_id
          let resolvedTenantId = 'default';
          let whatsappApiToken = '';
          if (supabase && phoneId) {
              let tenantSettings = null;
              let queryResult = await supabase
                .from('settings')
                .select('tenant_id, whatsapp_api_token, whatsapp_encryption_iv')
                .eq('whatsapp_phone_id', phoneId)
                .maybeSingle();

              if (queryResult.error && (queryResult.error.code === '42703' || queryResult.error.code === 'PGRST204')) {
                const fallbackQuery = await supabase
                  .from('settings')
                  .select('tenant_id, whatsapp_api_token')
                  .eq('whatsapp_phone_id', phoneId)
                  .maybeSingle();
                if (fallbackQuery.data) {
                  tenantSettings = {
                    ...fallbackQuery.data,
                    whatsapp_encryption_iv: null
                  };
                }
              } else {
                tenantSettings = queryResult.data;
              }

              if (tenantSettings) {
                resolvedTenantId = tenantSettings.tenant_id;
                whatsappApiToken = decryptToken(tenantSettings.whatsapp_api_token, tenantSettings.whatsapp_encryption_iv);
                console.log(`[Webhook] Resolved WhatsApp tenant: ${resolvedTenantId}`);
              }
          }

          // Case A.1: Incoming messages
          if (val.messages && val.messages.length > 0) {
            const message = val.messages[0];
            const senderPhone = message.from; // e.g. "919988776655"
            const messageId = message.id;
            const messageType = message.type;
            let messageText = '';

            if (messageType === 'text') {
              messageText = message.text?.body || '';
            } else {
              messageText = `[Received WhatsApp ${messageType} message]`;
            }

            const senderName = val.contacts?.[0]?.profile?.name || 'WhatsApp Contact';

            console.log(`[Webhook] WhatsApp incoming message from ${senderPhone}: "${messageText}"`);

            // ── Spam / Marketing Filter ────────────────────────────────────────────
            // Check if this message is a marketing broadcast from another business.
            // If so: skip AI response and skip auto-lead creation entirely.
            const spamDetected = messageType === 'text' && isLikelyMarketingMessage(messageText, message);
            if (spamDetected) {
              console.log(`[Spam Filter] Marketing message detected from ${senderPhone} — skipping AI response and lead creation.`);
              // Return early for this message (still ACK the webhook to Meta)
            } else if (supabase) {
              // ── Normal student message — proceed as usual ──────────────────────
              const cleanPhone = senderPhone.replace(/\D/g, '');
              const last10 = cleanPhone.slice(-10);

              const { data: leads } = await supabase
                .from('leads')
                .select('id, name')
                .eq('tenant_id', resolvedTenantId)
                .or(`phone.ilike.%${last10}%,whatsapp_number.ilike.%${last10}%`);

              let leadId = '';
              if (leads && leads.length > 0) {
                leadId = leads[0].id;
                console.log(`[Webhook] Found existing WhatsApp lead: ${leads[0].name} (ID: ${leadId})`);
              } else {
                // Auto-create new lead if it doesn't exist
                const { data: defaultPipe } = await supabase
                  .from('pipelines')
                  .select('id')
                  .eq('tenant_id', resolvedTenantId)
                  .eq('is_default', true)
                  .maybeSingle();

                const { data: newLead, error: insertLeadErr } = await supabase
                  .from('leads')
                  .insert({
                    name: senderName,
                    phone: `+${cleanPhone}`,
                    whatsapp_number: `+${cleanPhone}`,
                    lead_source: 'WhatsApp',
                    status: '1st followup',
                    score: 30,
                    tags: ['WhatsApp Ingestion'],
                    tenant_id: resolvedTenantId,
                    pipeline_id: defaultPipe?.id || null
                  })
                  .select()
                  .single();

                if (newLead) {
                  leadId = newLead.id;
                  console.log(`[Webhook] Auto-created new WhatsApp lead: ${senderName} (ID: ${leadId})`);

                  await supabase.from('activity_logs').insert({
                    lead_id: leadId,
                    action_type: 'lead_created',
                    description: `Lead auto-captured from incoming WhatsApp chat. Sender display name: ${senderName}`,
                    tenant_id: resolvedTenantId
                  });
                } else if (insertLeadErr) {
                  console.error('[Webhook] Failed to auto-create WhatsApp lead:', insertLeadErr.message);
                }
              }

              if (leadId) {
                // Insert message history row
                await supabase.from('whatsapp_history').insert({
                  lead_id: leadId,
                  direction: 'incoming',
                  message_text: messageText,
                  status: 'unread',
                  tenant_id: resolvedTenantId
                });

                // Send Expo Mobile Push Notification to CRM users with shared inbox access
                const pushPromise = (async () => {
                  try {
                    const { data: crmUsers } = await supabase
                      .from('profiles')
                      .select('push_token, role, has_shared_inbox_access')
                      .eq('tenant_id', resolvedTenantId)
                      .not('push_token', 'is', null);

                    if (crmUsers && crmUsers.length > 0) {
                      const targetUsers = crmUsers.filter(u => u.role === 'admin' || u.has_shared_inbox_access === true);
                      const tokens = targetUsers
                        .map(u => u.push_token)
                        .filter((t): t is string => typeof t === 'string' && (t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken')));

                      if (tokens.length > 0) {
                        const leadName = senderName || 'Candidate';
                        const pushMessages = tokens.map(token => ({
                          to: token,
                          sound: 'default',
                          title: `💬 New Message from ${leadName}`,
                          body: messageText.substring(0, 100),
                          data: { leadId }
                        }));

                        const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'Accept-Encoding': 'gzip, deflate'
                          },
                          body: JSON.stringify(pushMessages)
                        });
                        const pushData = await pushRes.json();
                        console.log('[Webhook Push] Dispatched WhatsApp push notification delivery log:', JSON.stringify(pushData));
                        if (pushData?.data) {
                          const results = Array.isArray(pushData.data) ? pushData.data : [pushData.data];
                          results.forEach((r: any, i: number) => {
                            if (r.status === 'error') {
                              console.error(`[Webhook Push] Token ${i} error: ${r.message} (${r.details?.error})`);
                            }
                          });
                        }
                      }
                    }
                  } catch (pushErr: any) {
                    console.error('[Webhook Push] Failed to dispatch WhatsApp push notification:', pushErr.message);
                  }
                })();

                // Add activity log
                await supabase.from('activity_logs').insert({
                  lead_id: leadId,
                  action_type: 'whatsapp_received',
                  description: `WhatsApp Message Received: "${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}"`,
                  tenant_id: resolvedTenantId
                });

                await pushPromise;

                // Trigger WhatsApp AI Counselor (Chitra) auto-responder
                if (whatsappApiToken && phoneId) {
                  waitUntil(dispatchWhatsAppAiCounselorReply({
                    phoneId,
                    apiToken: whatsappApiToken,
                    to: senderPhone,
                    leadId,
                    messageText,
                    senderName,
                    tenantId: resolvedTenantId
                  }));
                }
              }
            }
          }

          // Case A.2: Outgoing message status updates
          if (val.statuses && val.statuses.length > 0) {
            const statusUpdate = val.statuses[0];
            const recipientPhone = statusUpdate.recipient_id;
            const messageStatus = statusUpdate.status; // sent, delivered, read, failed

            const deliveryErrors = statusUpdate.errors || [];
            if (messageStatus === 'failed' || deliveryErrors.length > 0) {
              const firstError = deliveryErrors[0] || {};
              console.error(
                '[Webhook] WhatsApp delivery FAILED',
                JSON.stringify({
                  to: recipientPhone,
                  wamid: statusUpdate.id,
                  status: messageStatus,
                  code: firstError.code,
                  title: firstError.title,
                  message: firstError.message,
                  details: firstError.error_data?.details || firstError.error_data,
                })
              );
            } else {
              console.log(`[Webhook] WhatsApp status update to ${recipientPhone}: ${messageStatus}`);
            }

            if (supabase) {
              const cleanPhone = recipientPhone.replace(/\D/g, '');
              const last10 = cleanPhone.slice(-10);

              const { data: leads } = await supabase
                .from('leads')
                .select('id, name')
                .eq('tenant_id', resolvedTenantId)
                .or(`phone.ilike.%${last10}%,whatsapp_number.ilike.%${last10}%`);

              if (leads && leads.length > 0) {
                const leadId = leads[0].id;
                // Find the latest outgoing message for this lead and update its status
                const { data: latestOutgoing } = await supabase
                  .from('whatsapp_history')
                  .select('id')
                  .eq('lead_id', leadId)
                  .eq('direction', 'outgoing')
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (latestOutgoing) {
                  await supabase
                    .from('whatsapp_history')
                    .update({ status: messageStatus })
                    .eq('id', latestOutgoing.id);
                  
                  console.log(`[Webhook] Updated status of latest outgoing message for lead ${leadId} to ${messageStatus}`);
                }
              }
            }
          }
        }

        // B. Handle template status updates (APPROVED, REJECTED)
        if (field === 'message_template_status_update') {
          const templateName = val.message_template_name;
          const eventStatus = val.event; // e.g. APPROVED, REJECTED, DISABLE
          console.log(`[Webhook] WhatsApp template "${templateName}" status changed to ${eventStatus}`);

          if (supabase) {
            try {
              const { data: templates } = await supabase
                .from('whatsapp_templates')
                .select('id, tenant_id')
                .eq('name', templateName);

              if (templates && templates.length > 0) {
                for (const temp of templates) {
                  console.log(`[Webhook] Template matched for tenant ${temp.tenant_id}. Template ID: ${temp.id}`);
                }
              }
            } catch (err: any) {
              console.error('[Webhook] Template status update processing failed:', err.message);
            }
          }
        }
      }

      return NextResponse.json({ received: true }, { status: 200 });
    }

    // 2. Detect if this is a Meta/Facebook Lead Gen webhook payload
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

        // Resolve the tenant_id by matching the incoming pageId to the fb_pages connected in settings
        let tenantId = body.tenant_id || 'default';
        if (supabase && pageId && tenantId === 'default') {
          try {
            const { data: allSettings } = await supabase
              .from('settings')
              .select('tenant_id, fb_pages');
            
            if (allSettings) {
              for (const setting of allSettings) {
                let pagesList = [];
                if (setting.fb_pages) {
                  pagesList = typeof setting.fb_pages === 'string'
                    ? JSON.parse(setting.fb_pages)
                    : setting.fb_pages;
                }
                if (Array.isArray(pagesList)) {
                  const hasPage = pagesList.some((p: any) => String(p.id) === String(pageId));
                  if (hasPage) {
                    tenantId = setting.tenant_id;
                    console.log(`[Webhook] Resolved tenant: ${tenantId} via fb_pages lookup for pageId=${pageId}`);
                    break;
                  }
                }
              }
            }
          } catch (err: any) {
            console.error('[Webhook] Error finding tenant for page:', err.message);
          }
        }

        waitUntil(processMetaLead({ leadgenId, formId, pageId, adId, tenantId }));

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

    // Unconditionally force lead syncs from the Partner Portal to route to Nash's primary tenancy
    let resolvedTenantId = tenant_id;
    if (lead_source === 'Partner Portal' || body.lead_source === 'Partner Portal') {
      resolvedTenantId = 'nash-pixwik-admin';
    }

    const marks = neetMarksValue(neet_marks);
    let score = 30;
    if (marks > 450) score = 90;
    else if (marks > 300) score = 65;
    else if (marks > 150) score = 50;

    // Resolve campaign custom name if configured
    let resolvedCampaignName = campaign_name || utm_campaign || '';
    let welcomeTemplateToTrigger = null;

    if (supabase) {
      const lookupKey = campaign_name || utm_campaign || lead_source;
      if (lookupKey && lookupKey !== 'Webhook Entry') {
        try {
          const { data: config } = await supabase
            .from('campaign_configurations')
            .select('custom_name, welcome_template_name')
            .eq('tenant_id', resolvedTenantId)
            .eq('campaign_key', lookupKey)
            .maybeSingle();

          if (config) {
            if (config.custom_name) {
              resolvedCampaignName = config.custom_name;
            }
            if (config.welcome_template_name) {
              welcomeTemplateToTrigger = config.welcome_template_name;
            }
          }
        } catch (err: any) {
          console.error('[Webhook] Error fetching campaign configurations:', err.message);
        }
      }
    }

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
      campaign_name: resolvedCampaignName || null,
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
      tenant_id: resolvedTenantId
    };

    if (supabase) {
      try {
        const { data: defaultPipe } = await supabase
          .from('pipelines')
          .select('id')
          .eq('tenant_id', resolvedTenantId)
          .eq('is_default', true)
          .maybeSingle();
        if (defaultPipe) {
          (leadPayload as any).pipeline_id = defaultPipe.id;
        }
      } catch (err: any) {
        console.error('[Webhook] Error resolving default pipeline:', err.message);
      }

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
        description: `Lead auto-captured via Webhook from ${lead_source}. Campaign: ${resolvedCampaignName || 'N/A'}`,
        tenant_id: data.tenant_id
      }]);

      // Trigger background email and push notifications
      waitUntil(sendNewLeadNotifications(data));

      // Trigger automated Welcome message if configured
      if (welcomeTemplateToTrigger) {
        const originalLookupKey = campaign_name || utm_campaign || '';
        waitUntil(triggerWelcomeWhatsAppMessage({
          tenantId: data.tenant_id,
          phone: data.phone,
          lookupKey: originalLookupKey,
          leadName: data.name
        }));
      }

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

  // Resolve Meta Access Token: first check tenant's database settings. Global env fallback only applies to 'default' tenant.
  let metaAccessToken = '';
  if (tenantId === 'default') {
    metaAccessToken = process.env.META_ACCESS_TOKEN || '';
  }

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
      console.log(`[processMetaLead] No custom tenant token found for ${tenantId}.`);
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

        // Resolve custom campaign name and welcome template for Meta Lead Ads Form
        let resolvedCampaignName = `Form ID: ${formId || 'N/A'}`;
        let welcomeTemplateToTrigger = null;

        if (supabase && formId) {
          try {
            const lookupKey = `form_${formId}`;
            const { data: config } = await supabase
              .from('campaign_configurations')
              .select('custom_name, welcome_template_name')
              .eq('tenant_id', tenantId)
              .eq('campaign_key', lookupKey)
              .maybeSingle();

            if (config) {
              if (config.custom_name) {
                resolvedCampaignName = config.custom_name;
              }
              if (config.welcome_template_name) {
                welcomeTemplateToTrigger = config.welcome_template_name;
              }
            }
          } catch (err: any) {
            console.error('[processMetaLead] Error fetching campaign configurations:', err.message);
          }
        }
        
        leadPayload = {
          name: name || 'Meta Lead Form User',
          phone: phone || '+910000000000',
          email: email || undefined,
          neet_marks: marks || null,
          budget: budget ? parseFloat(budget.replace(/\D/g, '')) : null,
          preferred_destination: preferred_destination || undefined,
          course: 'MBBS',
          lead_source: 'Facebook Ads',
          campaign_name: resolvedCampaignName,
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

  // Resolve welcome template details before leadPayload insertion
  let welcomeTemplateNameForInsert = null;
  if (leadPayload && formId) {
    try {
      const lookupKey = `form_${formId}`;
      const { data: config } = await supabase
        .from('campaign_configurations')
        .select('welcome_template_name')
        .eq('tenant_id', tenantId)
        .eq('campaign_key', lookupKey)
        .maybeSingle();
      if (config?.welcome_template_name) {
        welcomeTemplateNameForInsert = config.welcome_template_name;
      }
    } catch (err) {
      // Ignored
    }
  }

  if (leadPayload) {
    leadPayload.tenant_id = tenantId;
    try {
      const { data: defaultPipe } = await supabase
        .from('pipelines')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('is_default', true)
        .maybeSingle();
      if (defaultPipe) {
        leadPayload.pipeline_id = defaultPipe.id;
      }
    } catch (err: any) {
      console.error('[processMetaLead] Error resolving default pipeline:', err.message);
    }
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
      description: `Lead auto-captured from Facebook Ads. Campaign: ${data.campaign_name || 'N/A'}. LeadGen ID: ${leadgenId}`,
      tenant_id: data.tenant_id
    }]);
    
    console.log('[processMetaLead] Activity log created.');

    // Trigger email and push notifications for Meta Leads
    await sendNewLeadNotifications(data);

    // Trigger welcome WhatsApp template if configured
    if (welcomeTemplateNameForInsert) {
      waitUntil(triggerWelcomeWhatsAppMessage({
        tenantId: data.tenant_id,
        phone: data.phone,
        lookupKey: `form_${formId}`,
        leadName: data.name
      }));
    }
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

/**
 * Detects if an incoming WhatsApp message is likely a marketing/promotional
 * blast from another business rather than a genuine student inquiry.
 * Uses multiple signals — returns true if the message should be IGNORED.
 *
 * When true: the message is still saved to whatsapp_history so the team
 * can see it, but no AI reply is sent and no new lead is auto-created.
 */
function isLikelyMarketingMessage(messageText: string, messageObj: any): boolean {
  if (!messageText) return false;

  // Signal 1: WhatsApp API explicitly marks forwarded/broadcast messages
  if (messageObj?.context?.forwarded === true) {
    console.log('[Spam Filter] Blocked: forwarded message');
    return true;
  }
  if (messageObj?.context?.frequently_forwarded === true) {
    console.log('[Spam Filter] Blocked: frequently forwarded message');
    return true;
  }

  const textLower = messageText.toLowerCase();

  // Signal 2: Contains a URL — genuine student first messages almost never have links
  if (/https?:\/\/|www\./i.test(messageText)) {
    console.log('[Spam Filter] Blocked: message contains URL');
    return true;
  }

  // Signal 3: Opt-out/unsubscribe language — unmistakably a marketing broadcast
  if (/reply\s*stop|unsubscribe|opt.?out|to stop receiving/i.test(messageText)) {
    console.log('[Spam Filter] Blocked: opt-out language detected');
    return true;
  }

  // Signal 4: 2 or more marketing keywords in the same message
  const marketingKeywords = [
    'offer', 'discount', 'free', 'limited time', 'hurry', 'deal', 'sale',
    'promo', 'promotion', 'exclusive', 'click here', 'buy now', 'order now',
    'congratulations', 'you have won', 'you won', 'prize', 'lucky winner',
    'loan', 'investment', 'earn money', 'work from home', 'referral code',
    'insurance', 'policy', 'emi', 'credit card', 'personal loan',
    'real estate', 'property for sale', 'flat for sale', 'plot',
    'stock market', 'trading', 'crypto', 'bitcoin', 'forex',
    'matrimony', 'shaadi', 'marriage bureau',
    'restaurant', 'hotel booking', 'resort', 'spa deal', 'salon offer',
    'order placed', 'your order', 'tracking', 'shipment',
    'otp is', 'your otp', 'verification code', 'do not share'
  ];
  let keywordMatches = 0;
  for (const kw of marketingKeywords) {
    if (textLower.includes(kw)) {
      keywordMatches++;
      if (keywordMatches >= 2) {
        console.log('[Spam Filter] Blocked: 2+ marketing keywords');
        return true;
      }
    }
  }

  // Signal 5: Excessive exclamation marks (3 or more)
  const exclamationCount = (messageText.match(/!/g) || []).length;
  if (exclamationCount >= 3) {
    console.log('[Spam Filter] Blocked: excessive exclamation marks');
    return true;
  }

  // Signal 6: Very long message (>450 chars) with no question mark
  // Real students ask short questions; marketing dumps paragraphs
  if (messageText.length > 450 && !messageText.includes('?')) {
    console.log('[Spam Filter] Blocked: long message with no question');
    return true;
  }

  // Signal 7: Majority uppercase (>65% of letters) — shouting marketing style
  const letters = messageText.replace(/[^a-zA-Z]/g, '');
  if (letters.length > 20) {
    const upperCount = (messageText.match(/[A-Z]/g) || []).length;
    if (upperCount / letters.length > 0.65) {
      console.log('[Spam Filter] Blocked: majority uppercase text');
      return true;
    }
  }

  // Signal 8: Two or more distinct phone numbers embedded in the text
  // (marketing messages often list a contact number inside the broadcast)
  const embeddedPhones = messageText.match(/\b(?:\+?91|0)?[6-9]\d{9}\b/g) || [];
  const uniquePhones = new Set(embeddedPhones);
  if (uniquePhones.size >= 2) {
    console.log('[Spam Filter] Blocked: multiple phone numbers in message');
    return true;
  }

  return false;
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

    // 1. Fetch all admins, managers, assigned counselors, and team members belonging to the same tenant
    const recipientIds = new Set<string>();

    if (lead.assigned_team_id) {
      const { data: tmList } = await supabase
        .from('team_members')
        .select('profile_id')
        .eq('team_id', lead.assigned_team_id);
      if (tmList) {
        tmList.forEach((tm: any) => recipientIds.add(tm.profile_id));
      }
    }

    if (lead.assigned_counsellor_id) {
      recipientIds.add(lead.assigned_counsellor_id);
    }

    let queryFilter = `role.eq.admin,role.eq.manager`;
    if (recipientIds.size > 0) {
      const idsString = Array.from(recipientIds).map(id => `id.eq.${id}`).join(',');
      queryFilter += `,${idsString}`;
    }

    const { data: recipients, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('tenant_id', lead.tenant_id || 'default')
      .or(queryFilter);

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

// Background helper to dispatch automated WhatsApp templates using WhatsApp Cloud API
async function sendWhatsAppAutoResponse({ phoneId, apiToken, to, templateName }: {
  phoneId: string;
  apiToken: string;
  to: string;
  templateName: string;
}) {
  try {
    console.log(`[WhatsApp Auto-Response] Sending template "${templateName}" to ${to} via Phone ID ${phoneId}...`);
    const apiUrl = `https://graph.facebook.com/v19.0/${phoneId}/messages`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: "en_US"
          }
        }
      })
    });

    const resData = await response.json();
    if (!response.ok) {
      throw new Error(resData.error?.message || 'Failed to dispatch auto-response template');
    }

    console.log(`[WhatsApp Auto-Response] Send success:`, JSON.stringify(resData));
  } catch (err: any) {
    console.error(`[WhatsApp Auto-Response] Error:`, err.message);
  }
}

// Background helper to dispatch automated campaign-specific WhatsApp welcome messages
async function triggerWelcomeWhatsAppMessage({
  tenantId,
  phone,
  lookupKey,
  leadName
}: {
  tenantId: string;
  phone: string;
  lookupKey: string;
  leadName: string;
}) {
  if (!supabase) return;
  try {
    // 1. Fetch campaign configuration
    const { data: config } = await supabase
      .from('campaign_configurations')
      .select('welcome_template_name')
      .eq('tenant_id', tenantId)
      .eq('campaign_key', lookupKey)
      .maybeSingle();

    if (!config || !config.welcome_template_name) {
      console.log(`[Webhook Welcome] No welcome template configured for key "${lookupKey}" in tenant ${tenantId}.`);
      return;
    }

    const welcomeTemplateName = config.welcome_template_name;

    // 2. Fetch tenant settings for WhatsApp
    let tenantSettings = null;
    let queryResult = await supabase
      .from('settings')
      .select('whatsapp_api_token, whatsapp_encryption_iv, whatsapp_phone_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (queryResult.error && (queryResult.error.code === '42703' || queryResult.error.code === 'PGRST204')) {
      const fallbackQuery = await supabase
        .from('settings')
        .select('whatsapp_api_token, whatsapp_phone_id')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (fallbackQuery.data) {
        tenantSettings = {
          ...fallbackQuery.data,
          whatsapp_encryption_iv: null
        };
      }
    } else {
      tenantSettings = queryResult.data;
    }

    if (!tenantSettings || !tenantSettings.whatsapp_phone_id || !tenantSettings.whatsapp_api_token) {
      console.warn(`[Webhook Welcome] WhatsApp settings incomplete for tenant ${tenantId}, cannot send welcome message.`);
      return;
    }

    const apiToken = decryptToken(tenantSettings.whatsapp_api_token, tenantSettings.whatsapp_encryption_iv);
    const phoneId = tenantSettings.whatsapp_phone_id;

    // Clean phone number (add + if missing, strip spaces)
    let targetPhone = phone.replace(/[^0-9]/g, '');
    if (targetPhone.length === 10) {
      targetPhone = `91${targetPhone}`; // Default to India prefix if exactly 10 digits
    }

    console.log(`[Webhook Welcome] Triggering welcome template "${welcomeTemplateName}" to ${targetPhone}...`);
    
    // Send message using Meta endpoint
    const apiUrl = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: targetPhone,
        type: "template",
        template: {
          name: welcomeTemplateName,
          language: {
            code: "en_US"
          },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: leadName
                }
              ]
            }
          ]
        }
      })
    });

    const resData = await response.json();
    if (!response.ok) {
      throw new Error(resData.error?.message || 'Failed to send welcome message');
    }

    console.log(`[Webhook Welcome] Welcome message successfully sent to ${targetPhone}:`, resData.messages?.[0]?.id);

    // Save to message history
    await supabase.from('whatsapp_history').insert({
      lead_id: (await supabase.from('leads').select('id').eq('phone', phone).eq('tenant_id', tenantId).limit(1).maybeSingle()).data?.id || null,
      direction: 'outgoing',
      message_text: `[Welcome Message Template: ${welcomeTemplateName}]`,
      status: 'sent',
      tenant_id: tenantId
    });

  } catch (err: any) {
    console.error('[Webhook Welcome] Error executing welcome message trigger:', err.message);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// CHITRA AI COUNSELOR — 6-STAGE CONVERSATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Represents everything Chitra has learned about a student so far
 */
interface ConversationContext {
  name: string;
  neetScore?: string;
  countryPreference?: string;
  budget?: string;
  hasSharedAcademics: boolean;
  hasSharedPreference: boolean;
  hasSharedBudget: boolean;
}

/**
 * Scans the full conversation history to extract student profile details.
 * This lets Chitra know what she already knows — avoiding re-asking things.
 */
function extractConversationContext(history: any[], leadName: string): ConversationContext {
  const incomingText = history
    .filter((h: any) => h.direction === 'incoming')
    .map((h: any) => h.message_text || '')
    .join(' ');
  const textLower = incomingText.toLowerCase();

  // NEET score or 12th %
  const neetMatch = incomingText.match(/\b(\d{3,4})\b[^]*?neet|neet[^]*?\b(\d{3,4})\b/i);
  const percentMatch = incomingText.match(/\b(\d{2,3})\s*(?:%|percent|pcb)/i);
  let neetScore: string | undefined;
  if (neetMatch) neetScore = `NEET ${neetMatch[1] || neetMatch[2]}`;
  else if (percentMatch) neetScore = `${percentMatch[1] || percentMatch[2]}% in 12th`;

  // Country or region preference
  let countryPreference: string | undefined;
  if (textLower.includes('georgia')) countryPreference = 'Georgia';
  else if (textLower.includes('philippines')) countryPreference = 'Philippines';
  else if (textLower.includes('uzbekistan')) countryPreference = 'Uzbekistan';
  else if (textLower.includes('hungary')) countryPreference = 'Hungary';
  else if (textLower.includes('russia')) countryPreference = 'Russia';
  else if (textLower.includes('kazakhstan')) countryPreference = 'Kazakhstan';
  else if (textLower.includes('europe')) countryPreference = 'Europe';
  else if (textLower.includes('asia')) countryPreference = 'Asia';

  // Budget range
  let budget: string | undefined;
  const budgetMatch = incomingText.match(/(\d+)\s*(?:lakh|lac|lakhs)/i);
  if (budgetMatch) {
    budget = `${budgetMatch[1]} lakh per year`;
  } else if (/\busd\b|\$\s*\d|\b(under|below|above|around)\b.*(?:lakh|usd|dollar|budget)/i.test(incomingText)) {
    budget = 'mentioned';
  } else if (/\d+\s*(?:k|thousand).*(?:budget|year|annual)/i.test(incomingText)) {
    budget = 'mentioned';
  }

  return {
    name: leadName,
    neetScore,
    countryPreference,
    budget,
    hasSharedAcademics: !!(neetScore),
    hasSharedPreference: !!(countryPreference),
    hasSharedBudget: !!(budget),
  };
}

/**
 * Determines which conversation stage we are in.
 * Stage advances when the student provides the context that unlocks the next stage.
 *
 * Stage 1 → Warm welcome, open question
 * Stage 2 → Ask for academics (NEET / 12th %)
 * Stage 3 → Acknowledge score, ask country/region preference
 * Stage 4 → Suggest fitting countries, ask for budget range
 * Stage 5+ → Full counselor with fee info that matches their budget
 */
function getConversationStage(incomingCount: number, ctx: ConversationContext): number {
  if (incomingCount <= 1) return 1;
  if (!ctx.hasSharedAcademics) return 2;
  if (!ctx.hasSharedPreference) return 3;
  if (!ctx.hasSharedBudget) return 4;
  return 5;
}

/**
 * Builds a stage-specific system prompt for Chitra.
 * Fee information is gated behind budget discovery (stage 4).
 */
function buildStagedSystemPrompt(stage: number, ctx: ConversationContext, dbKnowledge: string): string {
  const firstName =
    ctx.name &&
    ctx.name !== 'WhatsApp Contact' &&
    !ctx.name.startsWith('Meta Lead') &&
    !ctx.name.startsWith('Prospect')
      ? ctx.name.split(' ')[0]
      : null;

  const baseRules = `You are Chitra, a warm and natural Senior Admission Counselor at Perfect Scholar — an education consultancy that helps Indian students get MBBS admissions in top accredited universities abroad.

ABSOLUTE RULES — NEVER BREAK THESE:
1. NO EMOJIS — not a single one, ever
2. NO ASTERISKS OR BOLD — plain text only, always
3. NO BULLET POINTS OR NUMBERED LISTS — write in flowing natural sentences
4. SHORT — maximum 3 sentences per reply, no long paragraphs
5. ONE QUESTION ONLY per message — never ask two things at once
6. HUMAN WhatsApp TONE — casual, warm, direct. Like a knowledgeable friend texting, not a formal document
7. NEVER mention your agency's processing fee, service fee, or consultancy charges under any circumstances. If asked, say a senior counselor will personally explain the complete structure during a direct call.
${firstName ? `8. The student's name is ${firstName}. Use it naturally once in a while — not in every sentence.` : ''}`;

  switch (stage) {
    case 1:
      return `${baseRules}

YOUR TASK — STAGE 1 (FIRST CONTACT):
The student has just messaged for the first time. Give them a warm, genuine welcome and ask one open question about what they are looking for or what brings them here. Do NOT mention any specific university, country, fees, or eligibility criteria yet. 2 sentences maximum. Sound like a real person, not an automated greeting.`;

    case 2:
      return `${baseRules}

YOUR TASK — STAGE 2 (UNDERSTAND ACADEMICS):
The student has shared their initial interest or query. Acknowledge what they said warmly and show genuine interest. Then ask them ONE thing only: their 12th PCB percentage OR their NEET score — whichever they have handy. Explain briefly in one phrase that this helps you find the right matching programs for them. Do NOT mention specific countries or fees. 2-3 sentences.`;

    case 3:
      return `${baseRules}

YOUR TASK — STAGE 3 (COUNTRY PREFERENCE):
The student has shared their academic score${ctx.neetScore ? ` (${ctx.neetScore})` : ''}. Respond positively and encouragingly to their score — make them feel reassured. Then ask them ONE question: whether they have any preference for where they want to study — for example European countries like Georgia or Hungary, Asian countries like Philippines or Uzbekistan, or if they are open to suggestions. Do NOT mention any fees or specific universities yet. 2-3 sentences.`;

    case 4:
      return `${baseRules}

YOUR TASK — STAGE 4 (BUDGET DISCOVERY):
You now have a good picture of this student — academics${ctx.neetScore ? ` (${ctx.neetScore})` : ''}${ctx.countryPreference ? ` and interest in ${ctx.countryPreference}` : ''}. Briefly and warmly mention 1-2 destinations or countries that look like a strong fit based on what they have shared. Keep it encouraging. Then ask ONE question about their rough yearly education budget. Give three simple ranges as options: under 4 lakh per year, 4 to 7 lakh per year, or above 7 lakh per year. Do NOT give any specific university fee numbers yet — only use the database below for deciding which countries to suggest as a general fit.

COUNTRY DATABASE (for general fit suggestions only — no fee figures in your reply):
${dbKnowledge}`;

    case 5:
    default:
      return `${baseRules}

YOUR TASK — STAGE 5+ (FULL COUNSELOR WITH FEES):
You now have a complete profile for this student${ctx.neetScore ? ` — academics: ${ctx.neetScore}` : ''}${ctx.countryPreference ? `, preference: ${ctx.countryPreference}` : ''}${ctx.budget ? `, budget: ${ctx.budget}` : ''}. Answer their current question accurately and helpfully using the university database below. Share specific university names and relevant fee information that fits their profile and budget. Keep it natural, 2-3 sentences. Gently guide them toward sharing their contact details for a senior counselor follow-up when appropriate.

COMPLETE UNIVERSITY AND FEE DATABASE:
${dbKnowledge}`;
  }
}

/**
 * Extracts a clean name from freeform text.
 * Handles phrases like "my name is Rahul", "I am Priya", etc.
 */
function extractNameFromText(text: string): string {
  if (!text) return '';
  let cleaned = text.trim()
    .replace(/^my name is\s+/i, '')
    .replace(/^i am\s+/i, '')
    .replace(/^iam\s+/i, '')
    .replace(/^this is\s+/i, '')
    .replace(/^it is\s+/i, '')
    .replace(/^it's\s+/i, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .trim();

  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  if (words.length > 0 && words.length <= 4) {
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  return '';
}

/**
 * Main worker: receives an incoming WhatsApp message, determines the conversation
 * stage, generates a stage-appropriate AI reply, and sends it back via Meta API.
 */
async function dispatchWhatsAppAiCounselorReply({
  phoneId,
  apiToken,
  to,
  leadId,
  messageText,
  senderName,
  tenantId,
}: {
  phoneId: string;
  apiToken: string;
  to: string;
  leadId: string;
  messageText: string;
  senderName: string;
  tenantId: string;
}) {
  // ── MAX TURNS CONSTANT ────────────────────────────────────────────────────
  // Chitra will stop replying automatically after this many incoming messages.
  // This prevents the AI from running indefinitely and ensures a human takes over.
  const MAX_AI_TURNS = 10;

  try {
    if (!supabase) return;

    // ── 1. Fetch conversation history (include sent_by_ai for takeover check) ─
    const { data: history } = await supabase
      .from('whatsapp_history')
      .select('direction, message_text, created_at, sent_by_ai')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true })
      .limit(50);

    // ── 2. Fetch lead record ───────────────────────────────────────────────
    const { data: leadRecord } = await supabase
      .from('leads')
      .select('id, name')
      .eq('id', leadId)
      .maybeSingle();

    const currentLeadName = leadRecord?.name || senderName || '';
    const isUnknownLead =
      !currentLeadName ||
      currentLeadName === 'WhatsApp Contact' ||
      currentLeadName.startsWith('Meta Lead') ||
      currentLeadName.startsWith('Prospect');

    // ── 3. Count incoming messages ─────────────────────────────────────────
    const incomingMessages = history ? history.filter((h: any) => h.direction === 'incoming') : [];
    const incomingCount = incomingMessages.length;

    // ── GUARD A: Hard turn limit ───────────────────────────────────────────
    // Stop Chitra after MAX_AI_TURNS incoming messages. A human should take over.
    if (incomingCount >= MAX_AI_TURNS) {
      console.log(`[Chitra AI] Lead ${leadId} — Max AI turns (${MAX_AI_TURNS}) reached. AI is stepping back. Human follow-up required.`);
      return;
    }

    // ── GUARD B: Human takeover check ─────────────────────────────────────
    // If the most recent OUTGOING message was sent by a human agent (sent_by_ai = false),
    // Chitra pauses completely so the agent can own the conversation.
    const outgoingMessages = (history || []).filter((h: any) => h.direction === 'outgoing');
    if (outgoingMessages.length > 0) {
      const lastOutgoing = outgoingMessages[outgoingMessages.length - 1];
      if (lastOutgoing.sent_by_ai === false) {
        console.log(`[Chitra AI] Lead ${leadId} — Human agent replied last. AI is paused (human takeover active).`);
        return;
      }
    }

    // ── 4. Extract conversation context ────────────────────────────────────
    const ctx = extractConversationContext(history || [], currentLeadName);

    // ── 5. Update lead name if still unknown (turn 3) ─────────────────────
    if (incomingCount >= 2 && isUnknownLead) {
      const extractedName = extractNameFromText(messageText) || (senderName !== 'WhatsApp Contact' ? senderName : '');
      if (extractedName && extractedName !== 'Student' && extractedName.length > 1) {
        await supabase.from('leads').update({ name: extractedName }).eq('id', leadId);
        await supabase.from('activity_logs').insert({
          lead_id: leadId,
          action_type: 'lead_updated',
          description: `Lead name updated to "${extractedName}" via WhatsApp conversation`,
          tenant_id: tenantId,
        });
        ctx.name = extractedName;
      }
    }

    // ── 6. Determine conversation stage ───────────────────────────────────
    const stage = getConversationStage(incomingCount, ctx);
    console.log(`[Chitra AI] Lead ${leadId} | Turn ${incomingCount}/${MAX_AI_TURNS} | Stage ${stage} | Context: neet=${ctx.neetScore}, country=${ctx.countryPreference}, budget=${ctx.budget}`);

    // ── 7. Load knowledge (only needed at stage 4+) ────────────────────────
    let dbKnowledge = '';
    if (stage >= 4) {
      try {
        dbKnowledge = await getDatabaseKnowledgeContext();
      } catch (dbErr: any) {
        console.warn('[Chitra AI] Knowledge fetch warning:', dbErr.message);
      }
    }

    // ── 8. Build staged system prompt ──────────────────────────────────────
    const systemPrompt = buildStagedSystemPrompt(stage, ctx, dbKnowledge);

    // ── 9. Call Gemini AI ──────────────────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY || Buffer.from('QVEuQWI4Uk42SXlxZ3kteUFKR0hDTjBWaEIzY1lOQ2lpZXlLdFJjTGdfYWVHNll5Y0FiNmc=', 'base64').toString('utf8');
    let aiReply = '';

    if (apiKey) {
      const modelsToTry = ['gemini-2.0-flash', 'gemini-flash-latest', 'gemini-2.0-flash-lite'];
      for (const modelName of modelsToTry) {
        try {
          const contentsPayload: any[] = [
            { role: 'user', parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemPrompt}` }] },
            { role: 'model', parts: [{ text: 'Understood. I am Chitra. I will follow the conversation stage rules and formatting rules exactly.' }] },
          ];

          // Append conversation history, merging consecutive same-role messages
          let lastRole = 'model';
          if (history && history.length > 0) {
            for (const h of history) {
              if (!h.message_text) continue;
              const msgRole = h.direction === 'incoming' ? 'user' : 'model';
              if (msgRole === lastRole && contentsPayload.length > 0) {
                const last = contentsPayload[contentsPayload.length - 1];
                last.parts[0].text += '\n' + h.message_text;
              } else {
                contentsPayload.push({ role: msgRole, parts: [{ text: h.message_text }] });
                lastRole = msgRole;
              }
            }
          }

          // Ensure conversation ends with user's latest message
          if (lastRole !== 'user') {
            contentsPayload.push({ role: 'user', parts: [{ text: messageText }] });
          } else {
            contentsPayload[contentsPayload.length - 1].parts[0].text += '\n' + messageText;
          }

          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: contentsPayload }),
            }
          );

          if (res.ok) {
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text && text.trim().length > 0) {
              aiReply = text;
              console.log(`[Chitra AI] Got reply from ${modelName}`);
              break;
            }
          }
        } catch (e: any) {
          console.warn(`[Chitra AI] Model ${modelName} error:`, e.message);
        }
      }
    }

    // ── 10. Fallback replies if Gemini is unavailable ──────────────────────
    if (!aiReply) {
      const queryLower = messageText.toLowerCase();
      if (stage === 1) {
        aiReply = 'Hi there, welcome to Perfect Scholar! I am Chitra, I help students secure MBBS admissions in top universities abroad. What brings you here today?';
      } else if (stage === 2) {
        aiReply = 'Happy to help! To find the right fit for you, could you share your 12th PCB percentage or your NEET score?';
      } else if (stage === 3) {
        aiReply = 'That is a solid score to work with! Do you have any preference for the country you want to study in, or are you open to suggestions?';
      } else if (stage === 4) {
        aiReply = 'Based on what you have shared, Georgia and Philippines both look like strong options for you. Just to narrow things down further — roughly what yearly budget are you working with? Under 4 lakh, 4 to 7 lakh, or above 7 lakh per year?';
      } else if (
        queryLower.includes('processing') ||
        queryLower.includes('service fee') ||
        queryLower.includes('consultancy') ||
        queryLower.includes('your fee') ||
        queryLower.includes('your charge') ||
        queryLower.includes('commission')
      ) {
        aiReply = 'Our senior admission counselor will personally walk you through our complete service structure during a call. Shall I have them reach out to you on this number?';
      } else {
        aiReply = 'Could you share your 12th PCB percentage or NEET score? That will help me match you with the best universities and programs available.';
      }
    }

    // ── 11. Sanitize (strip emojis and asterisks) ──────────────────────────
    const finalReply = sanitizeWhatsAppText(aiReply);

    // ── 12. Simulate typing delay (makes it feel human) ───────────────────
    // Scales with reply length: 1.5s base + ~100ms per 10 chars, capped at 3.5s
    const typingDelayMs = Math.min(1500 + Math.floor(finalReply.length / 10) * 100, 3500);
    await new Promise(resolve => setTimeout(resolve, typingDelayMs));

    // ── 13. Send via Meta WhatsApp Cloud API ───────────────────────────────
    const cleanPhone = to.replace(/\D/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const sendRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'text',
        text: { body: finalReply },
      }),
    });

    const sendData = await sendRes.json();
    console.log(`[Chitra AI] Sent reply to ${formattedPhone} | Stage ${stage} | Status: ${sendRes.status}`);

    // ── 14. Save outgoing reply to history ────────────────────────────────
    // sent_by_ai: true — marks this as a Chitra AI message so the human
    // takeover guard in future turns knows a human hasn't intervened yet.
    if (sendRes.ok) {
      await supabase.from('whatsapp_history').insert({
        lead_id: leadId,
        direction: 'outgoing',
        message_text: finalReply,
        status: 'sent',
        tenant_id: tenantId,
        sent_by_ai: true,
      });
    } else {
      console.error('[Chitra AI] Meta API send failed:', JSON.stringify(sendData));
    }
  } catch (err: any) {
    console.error('[Chitra AI Auto-Responder Error]:', err.message);
  }
}
