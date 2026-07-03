import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/fb-oauth/callback — Facebook redirects here after the user logs in
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const { searchParams } = req.nextUrl;

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDesc = searchParams.get('error_description');
  const mockPagesJson = searchParams.get('pages');

  // ── 1. Handle user-denied / errors from Facebook ──────────────────────────
  if (error || !code) {
    console.error('[fb-oauth/callback] Facebook returned error:', error, errorDesc);
    const redirectUrl = new URL('/', origin);
    redirectUrl.searchParams.set('view', 'settings');
    redirectUrl.searchParams.set('fb_error', errorDesc || error || 'Access denied');
    return NextResponse.redirect(redirectUrl.toString());
  }

  // ── 2. Decode state to recover tenant_id ──────────────────────────────────
  let tenantId = 'default';
  try {
    const decoded = Buffer.from(state || '', 'base64url').toString('utf8');
    tenantId = decoded.split('|')[0] || 'default';
  } catch {
    console.warn('[fb-oauth/callback] Could not decode state param, using default tenant');
  }

  const appId = process.env.NEXT_PUBLIC_FB_APP_ID;
  const appSecret = process.env.FB_APP_SECRET;
  const redirectUri = `${origin}/api/fb-oauth/callback`;

  let longLivedToken = '';
  let pages: Array<{ id: string; name: string; access_token: string }> = [];

  if (!appId || !appSecret) {
    console.error('[fb-oauth/callback] FB_APP_ID or FB_APP_SECRET not configured');
    const redirectUrl = new URL('/', origin);
    redirectUrl.searchParams.set('view', 'settings');
    redirectUrl.searchParams.set('fb_error', 'Server configuration error');
    return NextResponse.redirect(redirectUrl.toString());
  }

  // ── 3. Exchange code → short-lived user access token ─────────────────────
  let shortLivedToken = '';
  try {
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        new URLSearchParams({
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code,
        }).toString()
    );
    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      throw new Error(tokenData.error.message);
    }
    shortLivedToken = tokenData.access_token;
    console.log('[fb-oauth/callback] Short-lived token obtained successfully');
  } catch (err: any) {
    console.error('[fb-oauth/callback] Token exchange failed:', err.message);
    const redirectUrl = new URL('/', origin);
    redirectUrl.searchParams.set('view', 'settings');
    redirectUrl.searchParams.set('fb_error', 'Token exchange failed: ' + err.message);
    return NextResponse.redirect(redirectUrl.toString());
  }

  // ── 4. Exchange short-lived → long-lived token (60 days) ─────────────────
  let expiresIn = 0;
  try {
    const llRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: shortLivedToken,
        }).toString()
    );
    const llData = await llRes.json();
    if (llData.error) {
      throw new Error(llData.error.message);
    }
    longLivedToken = llData.access_token;
    expiresIn = llData.expires_in ?? 0;
    console.log(`[fb-oauth/callback] Long-lived token obtained. Expires in ${expiresIn}s`);
  } catch (err: any) {
    console.error('[fb-oauth/callback] Long-lived token exchange failed:', err.message);
    // Fall back to short-lived token rather than failing completely
    longLivedToken = shortLivedToken;
  }

  // ── 5. Fetch the user's Pages so we can pick the right one ───────────────
  try {
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token&access_token=${longLivedToken}`
    );
    const pagesData = await pagesRes.json();
    pages = pagesData.data || [];
    console.log(`[fb-oauth/callback] Found ${pages.length} page(s) for this user`);
  } catch (err: any) {
    console.warn('[fb-oauth/callback] Could not fetch pages:', err.message);
  }

  // ── 6. Persist token (and page list) to settings table ───────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey);
    const { error: dbError } = await supabase
      .from('settings')
      .upsert({
        tenant_id: tenantId,
        meta_access_token: longLivedToken,
        fb_connected_at: new Date().toISOString(),
        fb_pages: JSON.stringify(pages),
      });

    if (dbError) {
      console.error('[fb-oauth/callback] Failed to save token to DB:', dbError.message);
    } else {
      console.log(`[fb-oauth/callback] ✅ Token saved for tenant: ${tenantId}`);
    }
  } else {
    console.warn('[fb-oauth/callback] Supabase not configured — token not persisted');
  }

  // ── 7. Redirect back to settings page with success flag ──────────────────
  const redirectUrl = new URL('/', origin);
  redirectUrl.searchParams.set('view', 'settings');
  redirectUrl.searchParams.set('fb', 'connected');
  redirectUrl.searchParams.set('pages', String(pages.length));
  return NextResponse.redirect(redirectUrl.toString());
}
