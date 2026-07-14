import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Called by a Supabase Database Webhook on INSERT into partner_announcements.
// Sends Expo push notifications to all relevant partner users.
//
// Setup in Supabase Dashboard → Database → Webhooks → Create Webhook:
//   Table: partner_announcements  |  Event: INSERT
//   URL: https://crm.perfectscholar.com/api/notify-announcement
//   Method: POST  |  Headers: { "Content-Type": "application/json" }

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Supabase webhook sends { type, table, record, old_record, schema }
    // Direct calls from CRM send the announcement fields directly
    const record = body.record ?? body;

    const {
      id: announcementId,
      title,
      content,
      target_partner_id,
      type: annType,
      priority,
    } = record;

    if (!title) {
      return NextResponse.json({ error: 'Invalid payload — no title found' }, { status: 400 });
    }

    console.log(`[notify-announcement] New announcement: "${title}", target_partner_id=${target_partner_id ?? 'broadcast'}`);

    // ── Decide who to notify ──────────────────────────────────────────────────
    let tokensQuery = supabaseAdmin
      .from('partner_users')
      .select('id, full_name, push_token, partner_id')
      .not('push_token', 'is', null);

    if (target_partner_id) {
      // Targeted announcement: only notify users of that specific partner agency
      tokensQuery = tokensQuery.eq('partner_id', target_partner_id);
    }
    // If target_partner_id is null → broadcast → notify ALL partner users with tokens

    const { data: users, error: usersErr } = await tokensQuery;

    if (usersErr) {
      console.error('[notify-announcement] Error fetching partner users:', usersErr.message);
      return NextResponse.json({ error: usersErr.message }, { status: 500 });
    }

    const validTokens = (users || [])
      .map((u: any) => u.push_token as string)
      .filter((t) => t && (t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken')));

    console.log(`[notify-announcement] Found ${validTokens.length} valid push tokens`);

    if (validTokens.length === 0) {
      return NextResponse.json({ ok: true, message: 'No push tokens registered — skipping push', tokensDispatched: 0 });
    }

    // ── Build notification content ────────────────────────────────────────────
    const pushTitle = title;
    const pushBody = content
      ? (content.length > 120 ? content.substring(0, 120) + '…' : content)
      : 'You have a new update from Perfect Scholar.';

    // Send in batches of 100 (Expo limit)
    const BATCH_SIZE = 100;
    const results: any[] = [];

    for (let i = 0; i < validTokens.length; i += BATCH_SIZE) {
      const batch = validTokens.slice(i, i + BATCH_SIZE);
      const messages = batch.map((token) => ({
        to: token,
        sound: 'default',
        title: pushTitle,
        body: pushBody,
        data: {
          announcementId: announcementId ?? '',
          type: annType ?? 'announcement',
          priority: priority ?? 'normal',
        },
        priority: priority === 'high' ? 'high' : 'normal',
      }));

      const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(messages),
      });

      const pushJson = await pushRes.json().catch(() => null);
      console.log(`[notify-announcement] Batch ${Math.floor(i / BATCH_SIZE) + 1} Expo response:`, JSON.stringify(pushJson));

      const batchResults = Array.isArray(pushJson?.data)
        ? pushJson.data
        : pushJson?.data ? [pushJson.data] : [];

      batchResults.forEach((r: any, idx: number) => {
        if (r?.status === 'error') {
          console.error(`[notify-announcement] Token ${batch[idx]} failed:`, r.message, r.details);
        } else {
          console.log(`[notify-announcement] Token ${idx + i} dispatched OK, id:`, r?.id);
        }
      });

      results.push(...batchResults);
    }

    return NextResponse.json({
      ok: true,
      announcement: title,
      targetPartner: target_partner_id ?? 'broadcast (all)',
      tokensDispatched: validTokens.length,
      results,
    });

  } catch (err: any) {
    console.error('[notify-announcement] Unexpected error:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
