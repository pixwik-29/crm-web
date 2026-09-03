import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MessagingService } from '@/lib/messaging/service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function isPublicImageUrl(url?: string | null): boolean {
  const value = String(url || '').trim();
  return /^https:\/\//i.test(value) && !value.includes('scontent.') && !value.includes('lookaside.fbsbx.com');
}

// POST /api/whatsapp/send — sends a single WhatsApp message to one lead
export async function POST(req: NextRequest) {
  try {
    const { tenantId, to, type = 'text', message, text, templateName, variables = [], templateBody, mediaUrl } = await req.json();

    if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    if (!to) return NextResponse.json({ error: 'to (phone number) is required' }, { status: 400 });

    let resolvedMedia = isPublicImageUrl(mediaUrl) ? mediaUrl : undefined;
    let resolvedBody = templateBody;

    if (type === 'template' && templateName && supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data: templateRow } = await supabase
        .from('whatsapp_templates')
        .select('body, attachment_url')
        .eq('name', templateName)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!resolvedMedia && isPublicImageUrl(templateRow?.attachment_url)) {
        resolvedMedia = templateRow.attachment_url;
      }
      if (!resolvedBody) resolvedBody = templateRow?.body || resolvedBody;
    }

    const provider = await MessagingService.getProviderForTenant(tenantId);

    const result = await provider.sendMessage({
      to,
      type: type as any,
      text: text || message,
      templateName,
      variables,
      templateBody: resolvedBody,
      mediaUrl: resolvedMedia,
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      status: result.status,
      to: result.to || to,
    });
  } catch (error: any) {
    console.error('[WhatsApp Send API] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
