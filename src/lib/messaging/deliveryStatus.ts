const STATUS_BUCKET = 'whatsapp_attachments';

export type DeliveryRecord = {
  messageId: string;
  to: string;
  status: string;
  errorCode?: number;
  errorTitle?: string;
  errorDetails?: string;
  updatedAt: string;
};

export function deliveryStatusKey(messageId: string) {
  return `delivery-status/${String(messageId).replace(/[^a-zA-Z0-9._-]/g, '_')}.json`;
}

export function formatDeliveryError(record: DeliveryRecord): string {
  const code = Number(record.errorCode);
  if (code === 131026) {
    return `WhatsApp could not deliver to ${record.to}. That number is not on WhatsApp, is invalid, or the user blocked this business.`;
  }
  if (code === 131053) {
    return `WhatsApp dropped the message to ${record.to} because the header image failed (131053). Attach a public JPEG/PNG on the template in CRM → Settings → WhatsApp.`;
  }
  if (code === 131047) {
    return `WhatsApp rejected a free-form message to ${record.to} outside the 24-hour window. Use an approved template.`;
  }
  if (code === 130472 || code === 131050) {
    return `WhatsApp did not deliver to ${record.to} because the user has marketing messages turned off.`;
  }
  if (code === 131042) {
    return `WhatsApp blocked the message to ${record.to} because Meta cannot charge this WhatsApp Business account (131042). Add a payment method in Meta Business Suite → WhatsApp Accounts → this WABA → Payment settings, assign it to this account, and set timezone/currency. This is not a CRM billing issue.`;
  }
  const detail = [record.errorCode, record.errorTitle, record.errorDetails].filter(Boolean).join(' — ');
  return `WhatsApp did not deliver to ${record.to}${detail ? `: ${detail}` : '. Meta sent no error details.'}`;
}

export async function writeDeliveryStatus(
  supabase: { storage: { from: (bucket: string) => any } },
  record: DeliveryRecord
) {
  const existing = await readDeliveryStatus(supabase, record.messageId);
  const terminal = new Set(['failed', 'delivered', 'read']);
  if (existing && terminal.has(existing.status) && !terminal.has(record.status)) return;
  if (existing?.status === 'failed' && record.status !== 'failed') return;

  const payload = JSON.stringify(record);
  const { error } = await supabase.storage.from(STATUS_BUCKET).upload(
    deliveryStatusKey(record.messageId),
    Buffer.from(payload),
    { upsert: true, contentType: 'application/json', cacheControl: '0' }
  );
  if (error) {
    console.warn('[deliveryStatus] Could not save WhatsApp status:', error.message);
  }
}

export async function readDeliveryStatus(
  supabase: { storage: { from: (bucket: string) => any } },
  messageId: string
): Promise<DeliveryRecord | null> {
  const { data, error } = await supabase.storage.from(STATUS_BUCKET).download(deliveryStatusKey(messageId));
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text()) as DeliveryRecord;
  } catch {
    return null;
  }
}

export async function waitForDelivery(
  supabase: { storage: { from: (bucket: string) => any } },
  messageId: string,
  timeoutMs = 10000
): Promise<DeliveryRecord | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const record = await readDeliveryStatus(supabase, messageId);
    if (record?.status === 'failed' || record?.status === 'delivered' || record?.status === 'read') {
      return record;
    }
  }
  return readDeliveryStatus(supabase, messageId);
}
