import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MessagingService } from '@/lib/messaging/service';
import { formatDeliveryError, waitForDelivery, writeDeliveryStatus } from '@/lib/messaging/deliveryStatus';
import { compileWhatsAppTemplateBody, logOutgoingWhatsApp } from '@/lib/messaging/whatsappLead';

export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function isPublicMediaUrl(url?: string | null): boolean {
  const value = String(url || '').trim();
  return /^https:\/\//i.test(value) && !value.includes('scontent.') && !value.includes('lookaside.fbsbx.com');
}

function guessSendType(file: File | null, fallback: string): string {
  if (!file) return fallback || 'text';
  const mime = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif)$/i.test(name)) return 'image';
  if (mime.startsWith('video/') || /\.(mp4|3gp|mov)$/i.test(name)) return 'video';
  return 'document';
}

async function parseSendRequest(req: NextRequest): Promise<{
  tenantId: string;
  to: string;
  type: string;
  message: string;
  text?: string;
  templateName?: string;
  variables: string[];
  templateBody?: string;
  mediaUrl?: string;
  mediaName?: string;
  mediaMime?: string;
  mediaBytes?: Buffer;
  waitForDeliveryStatus: boolean;
  logHistory: boolean;
}> {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const fileValue = form.get('file');
    const file = fileValue instanceof File ? fileValue : null;
    const requestedType = String(form.get('type') || '');
    return {
      tenantId: String(form.get('tenantId') || ''),
      to: String(form.get('to') || ''),
      type: file ? guessSendType(file, requestedType) : (requestedType || 'text'),
      message: String(form.get('message') || form.get('text') || ''),
      templateName: String(form.get('templateName') || '') || undefined,
      variables: [],
      templateBody: String(form.get('templateBody') || '') || undefined,
      mediaUrl: String(form.get('mediaUrl') || '') || undefined,
      mediaName: file?.name || String(form.get('mediaName') || '') || undefined,
      mediaMime: file?.type || undefined,
      mediaBytes: file ? Buffer.from(await file.arrayBuffer()) : undefined,
      waitForDeliveryStatus: String(form.get('waitForDeliveryStatus') || 'true') !== 'false',
      logHistory: String(form.get('logHistory') || '') === 'true',
    };
  }

  const body = await req.json();
  return {
    tenantId: body.tenantId || '',
    to: body.to || '',
    type: body.type || 'text',
    message: body.message || '',
    text: body.text,
    templateName: body.templateName,
    variables: Array.isArray(body.variables) ? body.variables : [],
    templateBody: body.templateBody,
    mediaUrl: body.mediaUrl,
    mediaName: body.mediaName,
    waitForDeliveryStatus: body.waitForDeliveryStatus !== false,
    logHistory: !!body.logHistory,
  };
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseSendRequest(req);
    const {
      tenantId,
      to,
      type,
      message,
      text,
      templateName,
      variables,
      templateBody,
      mediaName,
      mediaMime,
      mediaBytes,
      waitForDeliveryStatus,
      logHistory,
    } = parsed;

    if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    if (!to) return NextResponse.json({ error: 'to (phone number) is required' }, { status: 400 });

    let resolvedMedia = isPublicMediaUrl(parsed.mediaUrl) ? parsed.mediaUrl : undefined;
    let resolvedBody = templateBody;
    const supabase = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

    if (type === 'template' && templateName && supabase) {
      const { data: templateRow } = await supabase
        .from('whatsapp_templates')
        .select('body, attachment_url')
        .eq('name', templateName)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!resolvedMedia && isPublicMediaUrl(templateRow?.attachment_url)) {
        resolvedMedia = templateRow?.attachment_url;
      }
      if (!resolvedBody) resolvedBody = templateRow?.body || resolvedBody;
    }

    const needsFile = type === 'document' || type === 'image' || type === 'video';
    if (needsFile && !mediaBytes?.length && !resolvedMedia) {
      return NextResponse.json({
        error: 'Attach a PDF, image, or video. WhatsApp will receive it as a file, not a link.',
      }, { status: 400 });
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
      mediaName,
      mediaMime,
      mediaBytes,
    });

    if (supabase && result.messageId) {
      await writeDeliveryStatus(supabase, {
        messageId: result.messageId,
        to: result.to || to,
        status: 'queued',
        updatedAt: new Date().toISOString(),
      });
    }

    let deliveryStatus = result.status || 'sent';
    if (supabase && waitForDeliveryStatus && result.messageId) {
      const delivery = await waitForDelivery(supabase, result.messageId, 12000);
      if (delivery?.status === 'failed') {
        if (logHistory) {
          const outgoingText =
            type === 'template'
              ? compileWhatsAppTemplateBody(resolvedBody, variables, templateName)
              : String(text || message || '').trim();
          await logOutgoingWhatsApp(supabase, {
            tenantId,
            phone: result.to || to,
            text: outgoingText || (templateName ? `[Sent template: ${templateName}]` : ''),
            status: 'failed',
          });
        }
        return NextResponse.json({
          error: formatDeliveryError(delivery),
          to: result.to || to,
          messageId: result.messageId,
          delivery: 'failed',
          errorCode: delivery.errorCode,
        }, { status: 422 });
      }
      deliveryStatus = delivery?.status || result.status;
      if (logHistory && !String(result.messageId).startsWith('wamid-mock-')) {
        const outgoingText =
          type === 'template'
            ? compileWhatsAppTemplateBody(resolvedBody, variables, templateName)
            : String(text || message || '').trim();
        await logOutgoingWhatsApp(supabase, {
          tenantId,
          phone: result.to || to,
          text: outgoingText || (templateName ? `[Sent template: ${templateName}]` : ''),
          status: deliveryStatus || 'sent',
        });
      }
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        status: deliveryStatus,
        to: result.to || to,
        delivery: delivery?.status || 'pending',
      });
    }

    if (logHistory && supabase && result.messageId && !String(result.messageId).startsWith('wamid-mock-')) {
      const outgoingText =
        type === 'template'
          ? compileWhatsAppTemplateBody(resolvedBody, variables, templateName)
          : String(text || message || '').trim();
      await logOutgoingWhatsApp(supabase, {
        tenantId,
        phone: result.to || to,
        text: outgoingText || (templateName ? `[Sent template: ${templateName}]` : ''),
        status: deliveryStatus || 'sent',
      });
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      status: result.status,
      to: result.to || to,
      delivery: 'queued',
    });
  } catch (error: any) {
    console.error('[WhatsApp Send API] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
