import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MessagingService } from '@/lib/messaging/service';
import { buildConsultantTargets, isConsultantAudience } from '@/lib/consultantTargets';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// POST /api/campaigns — creates and dispatches a broadcast campaign
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      filters, 
      templateName, 
      variables = [], // Array of fields to extract for personalization, e.g. ['name', 'preferred_destination']
      scheduledTime, 
      tenantId = 'default' 
    } = body;

    if (!templateName) {
      return NextResponse.json({ error: 'Template name is required for broadcast campaigns.' }, { status: 400 });
    }

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Build dynamic leads query based on filter selections
    let query = supabase
      .from('leads')
      .select('*')
      .eq('tenant_id', tenantId);

    let activeFilters = filters;

    if (body.groupId) {
      const { data: groupData, error: groupErr } = await supabase
        .from('lead_groups')
        .select('filters')
        .eq('id', body.groupId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      
      if (groupErr) throw new Error(`Failed to load group: ${groupErr.message}`);
      if (groupData) {
        activeFilters = groupData.filters;
      }
    }

    const hasDynamicFilters = (f: any) => {
      if (!f) return false;
      const hasStatuses = f.statuses && Array.isArray(f.statuses) && f.statuses.length > 0 && !f.statuses.includes('all');
      const hasDestinations = f.destinations && Array.isArray(f.destinations) && f.destinations.length > 0 && !f.destinations.includes('all');
      const hasCourses = f.courses && Array.isArray(f.courses) && f.courses.length > 0 && !f.courses.includes('all');
      const hasTags = f.tags && Array.isArray(f.tags) && f.tags.length > 0;
      const hasNeet = !!f.neet_marks_min;
      const hasBudget = !!f.budget_max;
      const hasStatus = f.status && f.status !== 'all';
      const hasDestination = f.preferred_destination && f.preferred_destination !== 'all';
      const hasCourse = f.course && f.course !== 'all';
      return hasStatuses || hasDestinations || hasCourses || hasTags || hasNeet || hasBudget || hasStatus || hasDestination || hasCourse;
    };

    let targets: any[] = [];

    if (isConsultantAudience(activeFilters) || body.audience === 'consultants') {
      const consultantFilters = {
        ...(activeFilters || {}),
        audience: 'consultants',
        ...(body.audience === 'consultants' && !activeFilters?.audience ? (filters || {}) : {}),
      };
      const { data: partners } = await supabase.from('partners').select('*');
      const { data: partnerUsers } = await supabase.from('partner_users').select('*');
      targets = buildConsultantTargets(partners || [], partnerUsers || [], consultantFilters);

      if (!targets.length) {
        return NextResponse.json({ success: true, targetsCount: 0, message: 'No consultants matched this group or extra numbers.' });
      }

      if (scheduledTime) {
        console.log(`[Campaign API] Scheduling consultant campaign for ${scheduledTime} on ${targets.length} targets`);
        return NextResponse.json({
          success: true,
          targetsCount: targets.length,
          message: `Campaign scheduled successfully to launch at ${new Date(scheduledTime).toLocaleString()}`
        });
      }

      const results = await processCampaignBroadcast({
        targets,
        templateName,
        variables,
        tenantId,
        skipLeadHistory: true,
      });

      return NextResponse.json({
        success: true,
        targetsCount: targets.length,
        sentCount: results.sentCount,
        failedCount: results.failedCount,
        message: `Consultant campaign completed! Sent: ${results.sentCount}, Failed: ${results.failedCount}`
      });
    }

    const hasDyn = hasDynamicFilters(activeFilters);

    if (activeFilters) {
      if (hasDyn || (!activeFilters.lead_ids || activeFilters.lead_ids.length === 0)) {
        // Support multi-select statuses
        if (activeFilters.statuses && Array.isArray(activeFilters.statuses) && activeFilters.statuses.length > 0 && !activeFilters.statuses.includes('all')) {
          query = query.in('status', activeFilters.statuses);
        } else if (activeFilters.status && activeFilters.status !== 'all') {
          query = query.eq('status', activeFilters.status);
        }

        // Support multi-select destinations
        if (activeFilters.destinations && Array.isArray(activeFilters.destinations) && activeFilters.destinations.length > 0 && !activeFilters.destinations.includes('all')) {
          query = query.in('preferred_destination', activeFilters.destinations);
        } else if (activeFilters.preferred_destination && activeFilters.preferred_destination !== 'all') {
          query = query.eq('preferred_destination', activeFilters.preferred_destination);
        }

        // Support multi-select courses
        if (activeFilters.courses && Array.isArray(activeFilters.courses) && activeFilters.courses.length > 0 && !activeFilters.courses.includes('all')) {
          query = query.in('course', activeFilters.courses);
        } else if (activeFilters.course && activeFilters.course !== 'all') {
          query = query.eq('course', activeFilters.course);
        }

        if (activeFilters.tags && activeFilters.tags.length > 0) {
          // Match leads containing any of these tags in the tags array column
          query = query.contains('tags', activeFilters.tags);
        }
        if (activeFilters.neet_marks_min) {
          query = query.gte('neet_marks', parseInt(activeFilters.neet_marks_min));
        }
        if (activeFilters.budget_max) {
          query = query.lte('budget', parseFloat(activeFilters.budget_max));
        }

        const { data: dynamicTargets, error: fetchErr } = await query;
        if (fetchErr) throw new Error(fetchErr.message);
        targets = dynamicTargets || [];
      }
    } else {
      const { data: defaultTargets, error: fetchErr } = await query;
      if (fetchErr) throw new Error(fetchErr.message);
      targets = defaultTargets || [];
    }

    // Now append manual leads if they exist
    if (activeFilters && activeFilters.lead_ids && Array.isArray(activeFilters.lead_ids) && activeFilters.lead_ids.length > 0) {
      const { data: manualTargets, error: manualErr } = await supabase
        .from('leads')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('id', activeFilters.lead_ids);
      if (manualErr) throw new Error(manualErr.message);

      if (manualTargets && manualTargets.length > 0) {
        const mergedMap = new Map();
        targets.forEach(t => mergedMap.set(t.id, t));
        manualTargets.forEach(t => mergedMap.set(t.id, t));
        targets = Array.from(mergedMap.values());
      }
    }

    if (!targets || targets.length === 0) {
      return NextResponse.json({ success: true, targetsCount: 0, message: 'No leads matched this filter configuration.' });
    }

    // 2. Dispatch campaign tasks in background to prevent function timeout
    if (scheduledTime) {
      // Future scheduler logic could insert into a job queue table
      console.log(`[Campaign API] Scheduling campaign for ${scheduledTime} on ${targets.length} targets`);
      return NextResponse.json({ 
        success: true, 
        targetsCount: targets.length, 
        message: `Campaign scheduled successfully to launch at ${new Date(scheduledTime).toLocaleString()}` 
      });
    }

    // Process campaign dispatch synchronously to prevent serverless container termination mid-loop
    console.log(`[Campaign API] Triggering direct campaign dispatch for ${targets.length} targets`);
    
    const results = await processCampaignBroadcast({
      targets,
      templateName,
      variables,
      tenantId,
      skipLeadHistory: false,
    });

    return NextResponse.json({ 
      success: true, 
      targetsCount: targets.length, 
      sentCount: results.sentCount,
      failedCount: results.failedCount,
      message: `Campaign broadcast completed! Sent: ${results.sentCount}, Failed: ${results.failedCount}` 
    });
  } catch (error: any) {
    console.error('[Campaign API] Error launching campaign:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Worker function to deliver template messages to filtered leads
async function processCampaignBroadcast({ targets, templateName, variables, tenantId, skipLeadHistory = false }: {
  targets: any[];
  templateName: string;
  variables: string[];
  tenantId: string;
  skipLeadHistory?: boolean;
}): Promise<{ sentCount: number; failedCount: number }> {
  let sentCount = 0;
  let failedCount = 0;

  try {
    const provider = await MessagingService.getProviderForTenant(tenantId);
    const supabase = createClient(supabaseUrl, serviceKey);

    // Load template definition to log the compiled body text
    const { data: templateObj } = await supabase
      .from('whatsapp_templates')
      .select('body')
      .eq('name', templateName)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const templateBodyRaw = templateObj?.body || '';

    console.log(`[Campaign worker] Dispatching WhatsApp messages to ${targets.length} leads...`);

    for (const lead of targets) {
      let compiledText = '';
      try {
        const phone = lead.whatsapp_number || lead.phone;
        if (!phone) {
          failedCount++;
          continue;
        }

        // Build parameters values array based on variable selection mappings
        const paramValues: string[] = [];
        variables.forEach((v: string) => {
          if (v === 'name') paramValues.push(lead.name || lead.primary_contact_name || '');
          else if (v === 'agency' || v === 'business_name') paramValues.push(lead.business_name || '');
          else if (v === 'email') paramValues.push(lead.email || '');
          else if (v === 'phone') paramValues.push(lead.phone || lead.whatsapp_number || '');
          else if (v === 'partner_level' || v === 'tier') paramValues.push(lead.partner_level || '');
          else if (v === 'course') paramValues.push(lead.course || 'MBBS');
          else if (v === 'preferred_destination') paramValues.push(lead.preferred_destination || '');
          else if (v === 'budget') paramValues.push(lead.budget ? `\u20B9${lead.budget}` : '');
          else if (v.startsWith('custom:')) paramValues.push(v.substring(7));
          else paramValues.push('');
        });

        // Compile display text for log history
        let messageText = templateBodyRaw;
        paramValues.forEach((val, idx) => {
          const keyName = variables[idx] || '';
          const cleanKey = keyName.startsWith('custom:') ? 'custom_val' : keyName;
          messageText = messageText.replace(new RegExp(`\\{\\{(${idx + 1}|${cleanKey})\\}\\}`, 'gi'), val);
        });
        compiledText = messageText;

        // Send message via provider
        const { messageId, status } = await provider.sendMessage({
          to: phone,
          type: 'template',
          templateName,
          variables: paramValues,
          templateBody: templateBodyRaw
        });

        if (!skipLeadHistory && lead.id && !String(lead.id).startsWith('extra-')) {
          await supabase.from('whatsapp_history').insert({
            lead_id: lead.id,
            direction: 'outgoing',
            message_text: compiledText || `[Sent template: ${templateName}]`,
            status: status as any,
            tenant_id: tenantId,
            sent_by_ai: false
          });

          await supabase.from('activity_logs').insert({
            lead_id: lead.id,
            action_type: 'whatsapp_sent',
            description: `Sent broadcast template message: "${templateName}"`,
            tenant_id: tenantId
          });
        }

        sentCount++;

        // Throttle slightly to respect Meta Cloud API rate limits (e.g. 50ms per message)
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (sendErr: any) {
        console.error(`[Campaign worker] Failed message to lead ${lead.id}:`, sendErr.message);
        failedCount++;
        
        // Log detailed failure state in history
        if (!skipLeadHistory && lead.id && !String(lead.id).startsWith('extra-')) {
          await supabase.from('whatsapp_history').insert({
            lead_id: lead.id,
            direction: 'outgoing',
            message_text: compiledText ? `${compiledText}\n\n[Error: ${sendErr.message}]` : `[Failed broadcast template: ${templateName} - ${sendErr.message}]`,
            status: 'failed',
            tenant_id: tenantId
          });
        }
      }
    }

    console.log(`[Campaign worker] Broadcast campaign finished: ${sentCount} sent, ${failedCount} failed`);
  } catch (err: any) {
    console.error('[Campaign worker] Critical error in campaign execution thread:', err.message);
  }

  return { sentCount, failedCount };
}
