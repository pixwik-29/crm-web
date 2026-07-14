import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This route is called server-side with service role key, bypassing RLS.
// It handles: status change → find partner student → get push tokens → send push notification.

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { leadId, newStatus, actorName } = body;

    if (!leadId || !newStatus) {
      return NextResponse.json({ error: 'leadId and newStatus are required' }, { status: 400 });
    }

    console.log(`[notify-status-change] Processing: lead=${leadId}, status="${newStatus}"`);

    // 1. Find partner_student linked to this CRM lead
    const { data: student, error: studentErr } = await supabaseAdmin
      .from('partner_students')
      .select('id, first_name, last_name, partner_id')
      .eq('crm_lead_id', leadId)
      .maybeSingle();

    if (studentErr) {
      console.error('[notify-status-change] Error fetching student:', studentErr.message);
      return NextResponse.json({ error: 'DB error fetching student' }, { status: 500 });
    }

    if (!student) {
      console.log('[notify-status-change] No linked partner student for lead:', leadId);
      return NextResponse.json({ ok: true, message: 'No linked student — nothing to notify' });
    }

    console.log(`[notify-status-change] Found student: ${student.first_name} ${student.last_name}, partner: ${student.partner_id}`);

    // 2. Update student's application_status to match CRM lead status
    const { error: updateErr } = await supabaseAdmin
      .from('partner_students')
      .update({ application_status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', student.id);

    if (updateErr) {
      console.error('[notify-status-change] Error updating student status:', updateErr.message);
    } else {
      console.log('[notify-status-change] Student status updated to:', newStatus);
    }

    // 3. Insert in-app announcement/notification for this partner
    const { error: announceErr } = await supabaseAdmin
      .from('partner_announcements')
      .insert([{
        title: '🎓 Student Status Update',
        content: `${student.first_name} ${student.last_name}'s application status has been updated to "${newStatus}".`,
        priority: 'normal',
        target_partner_id: student.partner_id,
        type: 'notification'
      }]);

    if (announceErr) {
      console.error('[notify-status-change] Error inserting announcement:', announceErr.message);
    } else {
      console.log('[notify-status-change] In-app announcement inserted for partner:', student.partner_id);
    }

    // 4. Fetch all partner users with push tokens for this partner
    const { data: partnerUsers, error: usersErr } = await supabaseAdmin
      .from('partner_users')
      .select('id, full_name, push_token')
      .eq('partner_id', student.partner_id)
      .not('push_token', 'is', null);

    if (usersErr) {
      console.error('[notify-status-change] Error fetching partner users:', usersErr.message);
      return NextResponse.json({ ok: true, message: 'Announcement sent, push failed (DB error)' });
    }

    const tokens = (partnerUsers || [])
      .map((u: any) => u.push_token)
      .filter((t: any) => typeof t === 'string' && (t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken')));

    console.log(`[notify-status-change] Found ${tokens.length} valid push tokens for partner ${student.partner_id}`);

    if (tokens.length === 0) {
      return NextResponse.json({ ok: true, message: 'Announcement inserted; no push tokens registered for this partner' });
    }

    // 5. Send Expo push notifications
    const pushMessages = tokens.map((token: string) => ({
      to: token,
      sound: 'default',
      title: '🎓 Student Status Update',
      body: `${student.first_name} ${student.last_name}'s application status has been updated to "${newStatus}".`,
      data: { link: `student:${student.id}` }
    }));

    const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(pushMessages)
    });

    const pushJson = await pushRes.json().catch(() => null);
    console.log(`[notify-status-change] Expo push response:`, JSON.stringify(pushJson));

    if (!pushRes.ok) {
      console.error('[notify-status-change] Expo push API error:', pushRes.status, pushJson);
      return NextResponse.json({ ok: true, message: 'Announcement inserted; push API error', expoError: pushJson }, { status: 200 });
    }

    // Log per-token results
    const results = Array.isArray(pushJson?.data) ? pushJson.data : (pushJson?.data ? [pushJson.data] : []);
    results.forEach((r: any, i: number) => {
      if (r?.status === 'error') {
        console.error(`[notify-status-change] Token ${tokens[i]} failed:`, r.message, r.details);
      } else {
        console.log(`[notify-status-change] Token ${i} (${(partnerUsers![i] as any)?.full_name}) dispatched OK, id:`, r?.id);
      }
    });

    return NextResponse.json({
      ok: true,
      student: `${student.first_name} ${student.last_name}`,
      tokensDispatched: tokens.length,
      expoResults: results
    });

  } catch (err: any) {
    console.error('[notify-status-change] Unexpected error:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
