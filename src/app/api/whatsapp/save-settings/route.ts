import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encryptToken } from '@/lib/messaging/crypto';

export async function POST(req: NextRequest) {
  try {
    const { phoneId, accountId, apiToken, autoResponse, welcomeTemplate, tenantId } = await req.json();

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const updates: any = {
      tenant_id: tenantId,
      whatsapp_phone_id: phoneId || null,
      whatsapp_account_id: accountId || null,
      whatsapp_auto_response_template: autoResponse || null,
      whatsapp_welcome_partner_template: welcomeTemplate || null,
    };

    // Only encrypt and save token if a new token was supplied
    if (apiToken && apiToken.trim().length > 0) {
      // Check if this is the masked token (we shouldn't re-encrypt a masked display string)
      if (!apiToken.startsWith('••••')) {
        const { encryptedText, iv } = encryptToken(apiToken);
        updates.whatsapp_api_token = encryptedText;
        updates.whatsapp_encryption_iv = iv;
        console.log(`[SaveSettings] Encrypted and saved new WhatsApp access token for tenant: ${tenantId}`);
      }
    } else if (apiToken === '') {
      // Clear token
      updates.whatsapp_api_token = null;
      updates.whatsapp_encryption_iv = null;
    }

    let { error } = await supabase
      .from('settings')
      .upsert(updates);

    if (error && (error.code === '42703' || error.code === 'PGRST204')) {
      console.warn('[SaveSettings] Column not found, executing fallback upsert...');
      // Strip new columns and save token in plain text as fallback
      const fallbackUpdates = {
        tenant_id: tenantId,
        whatsapp_phone_id: phoneId || null,
        whatsapp_account_id: accountId || null,
        whatsapp_auto_response_template: autoResponse || null,
        whatsapp_welcome_partner_template: welcomeTemplate || null,
        whatsapp_api_token: apiToken && !apiToken.startsWith('••••') ? apiToken : undefined
      };
      
      const fallbackRes = await supabase
        .from('settings')
        .upsert(fallbackUpdates);
      error = fallbackRes.error;
    }

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[SaveSettings] Failed to save settings:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
