export type IncomingWhatsAppContent = {
  messageText: string;
  mediaId?: string;
  mimeType?: string;
  caption?: string;
  links: string[];
};

export type ConsultantMatch = {
  kind: 'partner' | 'staff';
  name: string;
  agency: string;
  level?: string;
  status?: string;
};

export type DownloadedMedia = {
  mimeType: string;
  base64: string;
};

const IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);
const DOC_MIMES = new Set(['application/pdf']);

export function extractIncomingWhatsAppContent(message: any): IncomingWhatsAppContent {
  const type = String(message?.type || 'text').toLowerCase().trim();
  const links: string[] = [];
  const collect = (text: string) => {
    const found = String(text || '').match(/https?:\/\/[^\s<>\]]+/gi) || [];
    links.push(...found.map((u) => u.replace(/[),.;]+$/g, '')));
  };

  const flowBody = (() => {
    const raw = message?.interactive?.nfm_reply?.response_json;
    if (!raw) return '';
    if (typeof raw === 'string') return raw.trim();
    try {
      return JSON.stringify(raw);
    } catch {
      return '';
    }
  })();

  const buttonLabel = [
    message?.button?.text,
    message?.interactive?.button_reply?.title,
    message?.interactive?.list_reply?.title,
    message?.interactive?.list_reply?.description,
    message?.interactive?.nfm_reply?.body,
    message?.interactive?.nfm_reply?.name,
    flowBody,
    message?.button?.payload,
    message?.interactive?.button_reply?.id,
  ].map((value) => String(value || '').trim()).find(Boolean);

  if (type === 'text') {
    const body = message.text?.body || '';
    collect(body);
    return { messageText: body, links };
  }

  if (type === 'image') {
    const caption = message.image?.caption || '';
    collect(caption);
    return {
      messageText: caption || '[Image received]',
      mediaId: message.image?.id,
      mimeType: message.image?.mime_type || 'image/jpeg',
      caption,
      links,
    };
  }

  if (type === 'document') {
    const caption = message.document?.caption || '';
    const name = message.document?.filename || 'document';
    collect(caption);
    return {
      messageText: caption ? `[Document: ${name}] ${caption}` : `[Document: ${name}]`,
      mediaId: message.document?.id,
      mimeType: message.document?.mime_type || 'application/octet-stream',
      caption,
      links,
    };
  }

  if (type === 'audio' || type === 'voice') {
    return {
      messageText: '[Voice note received]',
      mediaId: message.audio?.id || message.voice?.id,
      mimeType: message.audio?.mime_type || message.voice?.mime_type,
      links,
    };
  }

  if (type === 'video') {
    const caption = message.video?.caption || '';
    collect(caption);
    return {
      messageText: caption || '[Video received]',
      mediaId: message.video?.id,
      mimeType: message.video?.mime_type,
      caption,
      links,
    };
  }

  if (type === 'sticker') return { messageText: '[Sticker received]', links };
  if (type === 'location') {
    const loc = message.location || {};
    return {
      messageText: `[Location] ${[loc.name, loc.address].filter(Boolean).join(', ')} ${loc.latitude || ''},${loc.longitude || ''}`.trim(),
      links,
    };
  }
  if (type === 'contacts') {
    const names = (message.contacts || []).map((c: any) => c.name?.formatted_name).filter(Boolean).join(', ');
    return { messageText: `[Contact card] ${names || 'shared'}`.trim(), links };
  }
  if (
    type === 'button' ||
    type === 'interactive' ||
    type === 'quick_reply' ||
    message?.button ||
    message?.interactive
  ) {
    collect(buttonLabel || '');
    return { messageText: buttonLabel || 'Button tapped', links };
  }
  if (type === 'reaction') {
    return { messageText: message.reaction?.emoji ? `Reacted ${message.reaction.emoji}` : '[Reaction]', links };
  }
  if (buttonLabel) {
    return { messageText: buttonLabel, links };
  }

  return { messageText: `[Received WhatsApp ${type} message]`, links };
}

export async function downloadWhatsAppMedia(apiToken: string, mediaId: string): Promise<DownloadedMedia | null> {
  try {
    const metaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    const metaJson = await metaRes.json();
    if (!metaRes.ok || !metaJson.url) return null;

    const fileRes = await fetch(metaJson.url, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    if (!fileRes.ok) return null;

    const mimeType = String(metaJson.mime_type || fileRes.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim();
    const buf = Buffer.from(await fileRes.arrayBuffer());
    if (buf.length < 200 || buf.length > 8 * 1024 * 1024) return null;
    return { mimeType, base64: buf.toString('base64') };
  } catch (err: any) {
    console.warn('[WhatsApp media] Download failed:', err.message);
    return null;
  }
}

export function mediaUsableByGemini(media?: DownloadedMedia | null): boolean {
  if (!media) return false;
  const mime = media.mimeType.toLowerCase();
  return IMAGE_MIMES.has(mime) || DOC_MIMES.has(mime) || mime.startsWith('image/');
}

export async function findConsultantByPhone(
  supabase: any,
  last10: string
): Promise<ConsultantMatch | null> {
  if (!last10 || last10.length < 8) return null;

  const matchesLast10 = (value?: string | null) => String(value || '').replace(/\D/g, '').endsWith(last10);

  const { data: partners } = await supabase
    .from('partners')
    .select('id, business_name, primary_contact_name, phone, whatsapp_number, partner_level, status')
    .or(`phone.ilike.%${last10}%,whatsapp_number.ilike.%${last10}%`)
    .limit(8);

  const partner = (partners || []).find((p: any) => matchesLast10(p.phone) || matchesLast10(p.whatsapp_number));
  if (partner) {
    return {
      kind: 'partner',
      name: partner.primary_contact_name || partner.business_name,
      agency: partner.business_name,
      level: partner.partner_level,
      status: partner.status,
    };
  }

  const { data: users } = await supabase
    .from('partner_users')
    .select('id, partner_id, full_name, phone, role')
    .ilike('phone', `%${last10}%`)
    .limit(8);

  const user = (users || []).find((u: any) => matchesLast10(u.phone));
  if (!user) return null;

  let agency = '';
  let level = '';
  let status = '';
  if (user.partner_id) {
    const { data: parent } = await supabase
      .from('partners')
      .select('business_name, partner_level, status')
      .eq('id', user.partner_id)
      .maybeSingle();
    agency = parent?.business_name || '';
    level = parent?.partner_level || '';
    status = parent?.status || '';
  }

  return {
    kind: 'staff',
    name: user.full_name || 'Consultant',
    agency,
    level,
    status,
  };
}

export function buildConsultantSystemPrompt(consultant: ConsultantMatch, dbKnowledge: string): string {
  const firstName = consultant.name?.split(' ')[0] || 'there';
  return `You are Chitra, the partner desk at Perfect Scholar. You are talking to an education consultant / agency recruiter, NOT a student looking for MBBS admission.

Consultant: ${consultant.name} (${consultant.agency || 'agency'})
Partner level: ${consultant.level || 'unknown'}
Status: ${consultant.status || 'unknown'}

ABSOLUTE RULES:
1. NO EMOJIS
2. NO ASTERISKS OR MARKDOWN. Plain text only.
3. You MAY include full https links. WhatsApp will preview them. Never wrap links in brackets or markdown.
4. SHORT — maximum 3 sentences. One question only.
5. Do NOT run the student admission funnel. Do NOT ask for NEET score, 12th percentage, or the consultant's own study plans.
6. Help with: partner portal login, referring students, commissions, college inventory, documents, onboarding, and student case status.
7. Portal: https://partner.perfectscholar.com
8. If they send a file or image (marksheet, passport, offer letter), acknowledge what you can see and say a coordinator will review it on the portal. Ask which student it belongs to if that is not clear.
9. Never quote consultancy processing fees. Direct commercial questions to their partner manager.
10. Use ${firstName} naturally, not in every sentence.

COLLEGE / COMMISSION CONTEXT (use only when relevant):
${dbKnowledge || 'College list is loading. Direct them to the partner portal for live inventory.'}`;
}

export function extractOutboundFiles(text: string): { images: string[]; documents: string[] } {
  const urls = String(text || '').match(/https?:\/\/[^\s<>\]]+/gi) || [];
  const images: string[] = [];
  const documents: string[] = [];
  for (const raw of urls) {
    const url = raw.replace(/[),.;]+$/g, '');
    if (/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url)) images.push(url);
    else if (/\.(pdf|doc|docx)(\?|$)/i.test(url)) documents.push(url);
  }
  return { images, documents };
}

export async function sendWhatsAppAutoReply({
  phoneId,
  apiToken,
  to,
  text,
  imageUrl,
  documentUrl,
}: {
  phoneId: string;
  apiToken: string;
  to: string;
  text: string;
  imageUrl?: string;
  documentUrl?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const send = async (body: any) => {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[WhatsApp auto-reply] Send failed:', JSON.stringify(data));
      return { ok: false, error: data.error?.message || 'send failed' };
    }
    return { ok: true };
  };

  const base = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
  };

  if (imageUrl) {
    const media = await send({
      ...base,
      type: 'image',
      image: { link: imageUrl, caption: text.slice(0, 1024) || undefined },
    });
    if (media.ok) return media;
  }

  if (documentUrl) {
    const media = await send({
      ...base,
      type: 'document',
      document: { link: documentUrl, filename: 'document.pdf', caption: text.slice(0, 1024) || undefined },
    });
    if (media.ok) return media;
  }

  return send({
    ...base,
    type: 'text',
    text: { preview_url: true, body: text },
  });
}
