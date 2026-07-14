import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Supabase credentials not configured' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Fetch destination URL matching the slug
    const { data: linkRow, error } = await supabase
      .from('redirect_links')
      .select('id, destination_url, clicks')
      .eq('slug', slug.trim().toLowerCase())
      .single();

    if (error || !linkRow) {
      return NextResponse.json({ error: 'Redirect link not found' }, { status: 404 });
    }

    // 2. Increment clicks count in the background
    supabase
      .from('redirect_links')
      .update({ clicks: (linkRow.clicks || 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', linkRow.id)
      .then(({ error: clickErr }) => {
        if (clickErr) console.warn('[Redirect] Clicks increment failed:', clickErr.message);
      });

    // 3. Make sure destination_url has protocol prefix
    let destination = linkRow.destination_url.trim();
    if (!/^https?:\/\//i.test(destination)) {
      destination = `https://${destination}`;
    }

    // 4. Perform redirect
    return NextResponse.redirect(destination, 307);
  } catch (err: any) {
    console.error('[Redirect] Routing error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
