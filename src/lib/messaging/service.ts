import { createClient } from '@supabase/supabase-js';
import { decryptToken } from './crypto';
import { MetaWhatsAppProvider } from './meta';
import { IMessagingProvider } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export class MessagingService {
  /**
   * Resolves and decrypts the credentials to return the appropriate messaging provider instance for a tenant.
   */
  static async getProviderForTenant(tenantId: string): Promise<IMessagingProvider> {
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Supabase database credentials are not configured on the server.');
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    let settings: any = null;
    let dbError: any = null;

    // Try to query all columns including newly added provider and encryption columns
    const firstQuery = await supabase
      .from('settings')
      .select('whatsapp_provider, whatsapp_api_token, whatsapp_encryption_iv, whatsapp_phone_id, whatsapp_account_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (firstQuery.error) {
      // If error is code 42703 (column does not exist), fall back to older settings schema
      if (firstQuery.error.code === '42703' || firstQuery.error.code === 'PGRST204') {
        console.warn(`[MessagingService] Settings columns not found, executing fallback query for tenant ${tenantId}...`);
        const fallbackQuery = await supabase
          .from('settings')
          .select('whatsapp_api_token, whatsapp_phone_id, whatsapp_account_id')
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (!fallbackQuery.error && fallbackQuery.data) {
          settings = {
            ...fallbackQuery.data,
            whatsapp_provider: 'meta',
            whatsapp_encryption_iv: null
          };
        } else {
          dbError = fallbackQuery.error || new Error('No settings row found in database');
        }
      } else {
        dbError = firstQuery.error;
      }
    } else {
      settings = firstQuery.data;
    }

    if (dbError || !settings) {
      const errMsg = dbError ? dbError.message : 'No settings row found in database';
      console.error(`[MessagingService] Failed to retrieve settings for tenant ${tenantId}:`, errMsg);
      throw new Error(`Failed to retrieve configuration settings for workspace: ${tenantId} (${errMsg})`);
    }

    const providerType = settings.whatsapp_provider || 'meta';
    
    // Decrypt the access token securely from database
    const rawToken = decryptToken(settings.whatsapp_api_token, settings.whatsapp_encryption_iv);

    if (!rawToken) {
      throw new Error(`WhatsApp API access token is missing or not authorized for workspace: ${tenantId}`);
    }

    if (providerType === 'meta') {
      const phoneId = settings.whatsapp_phone_id || '';
      const accountId = settings.whatsapp_account_id || '';
      
      if (!phoneId || !accountId) {
        throw new Error(`WhatsApp Phone ID and WABA Account ID must be configured for workspace: ${tenantId}`);
      }
      
      return new MetaWhatsAppProvider(rawToken, phoneId, accountId);
    }

    // Support additional provider classes (e.g. Twilio, SMS, RCS) here in the future
    throw new Error(`Unsupported messaging provider: ${providerType}`);
  }
}
