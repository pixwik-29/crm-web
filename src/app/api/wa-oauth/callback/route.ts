import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encryptToken } from '@/lib/messaging/crypto';

// GET /api/wa-oauth/callback — Meta redirects here after successful WhatsApp Embedded Signup authorization
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const { searchParams } = req.nextUrl;

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDesc = searchParams.get('error_description');

  // ── 1. Handle user-denied / errors from Meta ──────────────────────────────
  if (error || !code) {
    console.error('[wa-oauth/callback] Meta/WhatsApp returned error:', error, errorDesc);
    const redirectUrl = new URL('/', origin);
    redirectUrl.searchParams.set('view', 'settings');
    redirectUrl.searchParams.set('wa_error', errorDesc || error || 'Access denied');
    return NextResponse.redirect(redirectUrl.toString());
  }

  // ── 2. Decode state to recover tenant_id ──────────────────────────────────
  let tenantId = 'default';
  try {
    const decoded = Buffer.from(state || '', 'base64url').toString('utf8');
    tenantId = decoded.split('|')[0] || 'default';
  } catch {
    console.warn('[wa-oauth/callback] Could not decode state param, using default tenant');
  }

  const appId = process.env.NEXT_PUBLIC_FB_APP_ID;
  const appSecret = process.env.FB_APP_SECRET;
  const redirectUri = `${origin}/api/wa-oauth/callback`;

  if (!appId || !appSecret) {
    console.error('[wa-oauth/callback] FB_APP_ID or FB_APP_SECRET not configured');
    const redirectUrl = new URL('/', origin);
    redirectUrl.searchParams.set('view', 'settings');
    redirectUrl.searchParams.set('wa_error', 'Server configuration error');
    return NextResponse.redirect(redirectUrl.toString());
  }

  // ── 3. Exchange code → User Access Token ─────────────────────────────────
  let accessToken = '';
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
    accessToken = tokenData.access_token;
    console.log('[wa-oauth/callback] Short-lived user access token obtained');
  } catch (err: any) {
    console.error('[wa-oauth/callback] Token exchange failed:', err.message);
    const redirectUrl = new URL('/', origin);
    redirectUrl.searchParams.set('view', 'settings');
    redirectUrl.searchParams.set('wa_error', 'Token exchange failed: ' + err.message);
    return NextResponse.redirect(redirectUrl.toString());
  }

  // ── 4. Fetch the user's WhatsApp Business Accounts (WABAs) ────────────────
  let wabaId = '';
  let phoneId = '';
  try {
    const wabaRes = await fetch(
      `https://graph.facebook.com/v19.0/me/whatsapp_business_accounts?access_token=${accessToken}`
    );
    const wabaData = await wabaRes.json();
    const accounts = wabaData.data || [];
    console.log(`[wa-oauth/callback] Found ${accounts.length} WhatsApp Business Account(s)`);

    if (accounts.length > 0) {
      // Pick the first WABA to auto-configure
      wabaId = accounts[0].id;
      console.log(`[wa-oauth/callback] Selected WhatsApp Business Account ID: ${wabaId}`);

      // ── 5. Fetch Phone Numbers connected to this WABA ──────────────────────
      const phoneRes = await fetch(
        `https://graph.facebook.com/v19.0/${wabaId}/phone_numbers?access_token=${accessToken}`
      );
      const phoneData = await phoneRes.json();
      const phones = phoneData.data || [];
      console.log(`[wa-oauth/callback] Found ${phones.length} phone number(s) inside WABA ${wabaId}`);

      if (phones.length > 0) {
        // Auto-configure the first active/verified phone number
        phoneId = phones[0].id;
        console.log(`[wa-oauth/callback] Selected Phone Number ID: ${phoneId} (${phones[0].display_phone_number})`);
      }
    }
  } catch (err: any) {
    console.warn('[wa-oauth/callback] Failed to retrieve WABA accounts or phone IDs:', err.message);
  }

  // ── 6. Persist token, WABA ID, and Phone ID to settings table ──────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceKey) {
    // Encrypt access token before storing
    const { encryptedText, iv } = encryptToken(accessToken);
    const supabase = createClient(supabaseUrl, serviceKey);
    const payload: any = {
      tenant_id: tenantId,
      whatsapp_api_token: encryptedText,
      whatsapp_encryption_iv: iv,
      whatsapp_account_id: wabaId || null,
      whatsapp_phone_id: phoneId || null,
    };

    let { error: dbError } = await supabase
      .from('settings')
      .upsert(payload);

    if (dbError && ((dbError as any).code === '42703' || (dbError as any).code === 'PGRST204')) {
      console.warn('[wa-oauth/callback] Column not found, executing fallback upsert...');
      const fallbackPayload = {
        tenant_id: tenantId,
        whatsapp_api_token: accessToken,
        whatsapp_account_id: wabaId || null,
        whatsapp_phone_id: phoneId || null,
      };
      const fallbackRes = await supabase
        .from('settings')
        .upsert(fallbackPayload);
      dbError = fallbackRes.error;
    }

    if (dbError) {
      console.error('[wa-oauth/callback] Failed to save WhatsApp credentials to DB:', dbError.message);
    } else {
      console.log(`[wa-oauth/callback] ✅ WhatsApp credentials saved for tenant: ${tenantId}`);
    }
  } else {
    console.warn('[wa-oauth/callback] Supabase not configured — token not persisted');
  }

  // ── 7. Redirect back to settings page with success flags ───────────────────
  const redirectUrl = new URL('/', origin);
  redirectUrl.searchParams.set('view', 'settings');
  redirectUrl.searchParams.set('wa', 'connected');
  if (wabaId) redirectUrl.searchParams.set('waba_id', wabaId);
  if (phoneId) redirectUrl.searchParams.set('phone_id', phoneId);

  return NextResponse.redirect(redirectUrl.toString());
}
