import { NextRequest, NextResponse } from 'next/server';

// GET /api/wa-oauth — redirects user to Meta/Facebook OAuth dialog for WhatsApp Embedded Signup
export async function GET(req: NextRequest) {
  const appId = process.env.NEXT_PUBLIC_FB_APP_ID;
  const origin = req.nextUrl.origin;

  // Read tenant_id from query param
  const tenantId = req.nextUrl.searchParams.get('tenant_id') || req.nextUrl.searchParams.get('tenant') || 'default';

  // Create a short-lived CSRF state token
  const statePayload = Buffer.from(`${tenantId}|${Date.now()}`).toString('base64url');
  const redirectUri = `${origin}/api/wa-oauth/callback`;

  if (!appId) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_FB_APP_ID is not configured in environment variables.' },
      { status: 500 }
    );
  }

  const configId = process.env.NEXT_PUBLIC_FB_CONFIG_ID || process.env.FB_CONFIG_ID;

  const fbDialogUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
  fbDialogUrl.searchParams.set('client_id', appId);
  fbDialogUrl.searchParams.set('redirect_uri', redirectUri);
  fbDialogUrl.searchParams.set('state', statePayload);
  fbDialogUrl.searchParams.set('response_type', 'code');

  // For WhatsApp Embedded Signup, we request whatsapp_business_management and whatsapp_business_messaging
  const scopes = [
    'public_profile',
    'email',
    'whatsapp_business_management',
    'whatsapp_business_messaging',
    'business_management'
  ];

  fbDialogUrl.searchParams.set('scope', scopes.join(','));

  // If a Login configuration ID is specified, we supply it to trigger the customized login experience
  if (configId) {
    fbDialogUrl.searchParams.set('config_id', configId);
    fbDialogUrl.searchParams.set('override_default_response_type', 'true');
    console.log(`[wa-oauth] Directing to WhatsApp Embedded Signup using config_id: ${configId}`);
  } else {
    console.log('[wa-oauth] Directing to WhatsApp Embedded Signup using standard scopes');
  }

  // Redirect the browser to Meta OAuth Dialog
  return NextResponse.redirect(fbDialogUrl.toString());
}
