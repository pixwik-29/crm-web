import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/fb-oauth — redirects user to Facebook OAuth dialog
export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appId = process.env.NEXT_PUBLIC_FB_APP_ID;
  const origin = req.nextUrl.origin;

  // Read tenant_id from query param (passed by the frontend button)
  const tenantId = req.nextUrl.searchParams.get('tenant_id') || req.nextUrl.searchParams.get('tenant') || 'default';

  // Create a short-lived CSRF state token: base64(tenantId|timestamp)
  const statePayload = Buffer.from(`${tenantId}|${Date.now()}`).toString('base64url');

  const redirectUri = `${origin}/api/fb-oauth/callback`;

  if (!appId) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_FB_APP_ID is not configured in environment variables.' },
      { status: 500 }
    );
  }

  const fbDialogUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
  fbDialogUrl.searchParams.set('client_id', appId);
  fbDialogUrl.searchParams.set('redirect_uri', redirectUri);
  fbDialogUrl.searchParams.set('state', statePayload);
  fbDialogUrl.searchParams.set(
    'scope',
    [
      'public_profile',
      'email',
      'pages_show_list',
      'pages_read_engagement',
      'leads_retrieval',
      'business_management',
    ].join(',')
  );
  fbDialogUrl.searchParams.set('response_type', 'code');

  // Redirect the browser to Facebook
  return NextResponse.redirect(fbDialogUrl.toString());
}
