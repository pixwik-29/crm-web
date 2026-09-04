import { findConsultantByPhone } from '@/lib/ai/whatsappAutoReply';

export function last10Digits(phone: string): string {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

export function compileWhatsAppTemplateBody(
  body: string | undefined,
  variables: string[] | undefined,
  templateName?: string
): string {
  const params = Array.isArray(variables) ? variables : [];
  let text = String(body || '');
  if (!text.trim()) {
    return templateName ? `[Sent template: ${templateName}]` : '';
  }
  params.forEach((val, idx) => {
    const safe = String(val ?? '-').replace(/[\r\n]+/g, ' ').trim() || '-';
    text = text.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), safe);
  });
  return text;
}

export async function findOrCreateWhatsAppLead(
  supabase: any,
  opts: {
    tenantId: string;
    phone: string;
    name?: string;
  }
): Promise<string | null> {
  const cleanPhone = String(opts.phone || '').replace(/\D/g, '');
  const last10 = cleanPhone.slice(-10);
  if (last10.length < 8) return null;

  const { data: leads } = await supabase
    .from('leads')
    .select('id, name, created_at')
    .eq('tenant_id', opts.tenantId)
    .or(`phone.ilike.%${last10}%,whatsapp_number.ilike.%${last10}%`)
    .order('created_at', { ascending: false })
    .limit(10);

  const match = (leads || []).find((lead: any) => {
    const phone = String(lead.phone || '').replace(/\D/g, '');
    const wa = String(lead.whatsapp_number || '').replace(/\D/g, '');
    return phone.endsWith(last10) || wa.endsWith(last10);
  }) || leads?.[0];

  if (match?.id) return match.id;

  const consultant = await findConsultantByPhone(supabase, last10);
  const { data: defaultPipe } = await supabase
    .from('pipelines')
    .select('id')
    .eq('tenant_id', opts.tenantId)
    .eq('is_default', true)
    .maybeSingle();

  const displayName =
    opts.name ||
    consultant?.name ||
    `WhatsApp ${last10}`;

  const { data: newLead, error } = await supabase
    .from('leads')
    .insert({
      name: displayName,
      phone: `+${cleanPhone}`,
      whatsapp_number: `+${cleanPhone}`,
      lead_source: consultant ? 'WhatsApp Consultant' : 'WhatsApp',
      status: '1st followup',
      score: consultant ? 50 : 30,
      tags: consultant ? ['Consultant', 'WhatsApp'] : ['WhatsApp Ingestion'],
      tenant_id: opts.tenantId,
      pipeline_id: defaultPipe?.id || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[WhatsApp lead] Failed to create lead:', error.message);
    return null;
  }

  return newLead?.id || null;
}

export async function resolveLeadIdForWhatsAppHistory(
  supabase: any,
  lead: { id?: string; name?: string; primary_contact_name?: string },
  tenantId: string,
  phone: string
): Promise<string | null> {
  const existingId = String(lead?.id || '');
  if (existingId && !existingId.startsWith('extra-')) {
    const { data } = await supabase.from('leads').select('id').eq('id', existingId).maybeSingle();
    if (data?.id) return data.id;
  }
  return findOrCreateWhatsAppLead(supabase, {
    tenantId,
    phone,
    name: lead?.name || lead?.primary_contact_name,
  });
}

export async function logOutgoingWhatsApp(
  supabase: any,
  opts: {
    tenantId: string;
    phone: string;
    text: string;
    status?: string;
    name?: string;
  }
): Promise<void> {
  try {
    const leadId = await findOrCreateWhatsAppLead(supabase, {
      tenantId: opts.tenantId,
      phone: opts.phone,
      name: opts.name,
    });
    if (!leadId) return;
    await supabase.from('whatsapp_history').insert({
      lead_id: leadId,
      direction: 'outgoing',
      message_text: opts.text || '',
      status: opts.status || 'sent',
      tenant_id: opts.tenantId,
      sent_by_ai: null,
    });
  } catch (err: any) {
    console.error('[WhatsApp lead] Failed to log outgoing message:', err?.message || err);
  }
}
