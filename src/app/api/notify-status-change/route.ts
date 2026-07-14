import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side notification dispatcher — uses service role key to bypass RLS.
// Handles all CRM → Partner push notification events.
//
// Supported event types:
//   status_change : lead status updated  → notify partner with new status
//   note_added    : note added to lead   → notify partner that counsellor added an update

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Resolve push tokens + student for a given CRM lead ID */
async function resolvePartnerContext(leadId: string) {
  const { data: student, error: studentErr } = await supabaseAdmin
    .from('partner_students')
    .select('id, first_name, last_name, partner_id')
    .eq('crm_lead_id', leadId)
    .maybeSingle();

  if (studentErr) throw new Error(`DB error fetching student: ${studentErr.message}`);
  if (!student) return null;

  const { data: partnerUsers, error: usersErr } = await supabaseAdmin
    .from('partner_users')
    .select('id, full_name, push_token')
    .eq('partner_id', student.partner_id)
    .not('push_token', 'is', null);

  if (usersErr) throw new Error(`DB error fetching partner users: ${usersErr.message}`);

  const tokens = (partnerUsers || [])
    .map((u: any) => u.push_token as string)
    .filter((t) => t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken'));

  return { student, partnerUsers: partnerUsers || [], tokens };
}

/** Insert an in-app partner announcement */
async function insertAnnouncement(partnerId: string, title: string, content: string) {
  const { error } = await supabaseAdmin
    .from('partner_announcements')
    .insert([{ title, content, priority: 'normal', target_partner_id: partnerId, type: 'notification' }]);
  if (error) console.error('[notify] Announcement insert error:', error.message);
  else console.log('[notify] In-app announcement inserted for partner:', partnerId);
}

/** Send Expo push notifications to a list of tokens */
async function sendExpoPush(tokens: string[], title: string, body: string, data: Record<string, string>) {
  if (tokens.length === 0) return { dispatched: 0, results: [] };

  const messages = tokens.map((token) => ({ to: token, sound: 'default', title, body, data }));

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Accept-Encoding': 'gzip, deflate' },
    body: JSON.stringify(messages),
  });

  const json = await res.json().catch(() => null);
  console.log('[notify] Expo push response:', JSON.stringify(json));

  const results = Array.isArray(json?.data) ? json.data : json?.data ? [json.data] : [];
  results.forEach((r: any, i: number) => {
    if (r?.status === 'error') console.error(`[notify] Token ${tokens[i]} failed:`, r.message, r.details);
    else console.log(`[notify] Token ${i} dispatched OK, id:`, r?.id);
  });

  return { dispatched: tokens.length, results };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventType, leadId, newStatus, noteContent, actorName } = body;

    if (!leadId || !eventType) {
      return NextResponse.json({ error: 'leadId and eventType are required' }, { status: 400 });
    }

    console.log(`[notify] Event: ${eventType}, lead: ${leadId}`);

    const ctx = await resolvePartnerContext(leadId);

    if (!ctx) {
      console.log('[notify] No linked partner student for lead:', leadId);
      return NextResponse.json({ ok: true, message: 'No linked student — nothing to notify' });
    }

    const { student, tokens } = ctx;
    const studentName = `${student.first_name} ${student.last_name}`;
    const actor = 'Perfect Scholar';

    // ── Event: status_change ──────────────────────────────────────────────────
    if (eventType === 'status_change') {
      if (!newStatus) return NextResponse.json({ error: 'newStatus is required for status_change' }, { status: 400 });

      // Update partner_student application_status
      const { error: updateErr } = await supabaseAdmin
        .from('partner_students')
        .update({ application_status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', student.id);
      if (updateErr) console.error('[notify] Student status update error:', updateErr.message);
      else console.log('[notify] Student status updated to:', newStatus);

      const title = '🎓 Student Status Update';
      const msgBody = `${studentName}'s application status has been updated to "${newStatus}".`;

      await insertAnnouncement(student.partner_id, title, msgBody);
      const pushResult = await sendExpoPush(tokens, title, msgBody, { link: `student:${student.id}` });

      return NextResponse.json({ ok: true, event: eventType, student: studentName, ...pushResult });
    }

    // ── Event: note_added ─────────────────────────────────────────────────────
    if (eventType === 'note_added') {
      if (!noteContent) return NextResponse.json({ error: 'noteContent is required for note_added' }, { status: 400 });

      const preview = noteContent.length > 60 ? noteContent.substring(0, 60) + '…' : noteContent;
      const title = '📝 New Note Added';
      const msgBody = `${actor} added a note for ${studentName}: "${preview}"`;

      await insertAnnouncement(student.partner_id, title, msgBody);
      const pushResult = await sendExpoPush(tokens, title, msgBody, { link: `student:${student.id}` });

      return NextResponse.json({ ok: true, event: eventType, student: studentName, ...pushResult });
    }

    return NextResponse.json({ error: `Unknown eventType: ${eventType}` }, { status: 400 });

  } catch (err: any) {
    console.error('[notify] Unexpected error:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
