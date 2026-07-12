import { NextRequest, NextResponse } from 'next/server';
import { MessagingService } from '@/lib/messaging/service';

// POST /api/whatsapp/send — sends a single WhatsApp message to one lead
export async function POST(req: NextRequest) {
  try {
    const { tenantId, to, type = 'text', message, templateName, variables = [] } = await req.json();

    if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    if (!to) return NextResponse.json({ error: 'to (phone number) is required' }, { status: 400 });

    const provider = await MessagingService.getProviderForTenant(tenantId);

    const { messageId, status } = await provider.sendMessage({
      to,
      type: type as any,
      text: message,       // SendMessageOptions uses 'text', not 'message'
      templateName,
      variables,
    });

    return NextResponse.json({ success: true, messageId, status });
  } catch (error: any) {
    console.error('[WhatsApp Send API] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
