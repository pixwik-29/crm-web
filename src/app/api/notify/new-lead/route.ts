import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Use service role key so RLS is bypassed and we can read all profiles
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { leadName, neetMarks, leadSource, leadId, excludeEmail } = body;

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }

    // Fetch ALL push tokens using service role key (bypasses RLS)
    const { data: crmUsers, error } = await supabase
      .from('profiles')
      .select('push_token, email')
      .not('push_token', 'is', null);

    if (error) {
      console.error('[NewLead Push] Failed to fetch profiles:', error.message);
      return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
    }

    if (!crmUsers || crmUsers.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No users with push tokens' });
    }

    // Exclude the sender, filter valid Expo tokens only
    const tokens = crmUsers
      .filter(u => u.email !== excludeEmail)
      .map(u => u.push_token)
      .filter((t): t is string =>
        typeof t === 'string' &&
        (t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken'))
      );

    if (tokens.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No eligible push tokens found' });
    }

    const pushMessages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title: '🔥 New Lead Registered!',
      body: `${leadName} - NEET: ${neetMarks || 'N/A'} - Source: ${leadSource || 'Unknown'}`,
      data: { leadId }
    }));

    const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate'
      },
      body: JSON.stringify(pushMessages)
    });

    const pushData = await pushRes.json();
    console.log('[NewLead Push] Expo response:', JSON.stringify(pushData));

    // Log any per-token errors
    if (pushData?.data) {
      const results = Array.isArray(pushData.data) ? pushData.data : [pushData.data];
      results.forEach((r: any, i: number) => {
        if (r.status === 'error') {
          console.error(`[NewLead Push] Token ${i} error: ${r.message} (${r.details?.error})`);
        }
      });
    }

    return NextResponse.json({ sent: tokens.length, expo: pushData });
  } catch (e: any) {
    console.error('[NewLead Push] Uncaught error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
