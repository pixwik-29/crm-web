import { IMessagingProvider, SendMessageOptions, WhatsAppTemplate } from './types';

export class MetaWhatsAppProvider implements IMessagingProvider {
  private apiToken: string;
  private phoneId: string;
  private accountId: string;
  private cachedTemplates: WhatsAppTemplate[] | null = null;
  private lastSyncTime: number = 0;
  private CACHE_TTL_MS: number = 5 * 60 * 1000; // 5 minute cache

  constructor(apiToken: string, phoneId: string, accountId: string) {
    this.apiToken = apiToken;
    this.phoneId = phoneId;
    this.accountId = accountId;
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json'
    };
  }

  async sendMessage(options: SendMessageOptions): Promise<{ messageId: string; status: string }> {
    const url = `https://graph.facebook.com/v19.0/${this.phoneId}/messages`;

    // Sanitize recipient phone number for Meta WhatsApp Cloud API (E.164 format)
    let cleanTo = String(options.to || '').replace(/[^0-9]/g, '');
    if (cleanTo.startsWith('00')) {
      cleanTo = cleanTo.substring(2);
    }
    if (cleanTo.startsWith('0') && cleanTo.length === 11) {
      cleanTo = cleanTo.substring(1);
    }
    if (cleanTo.length === 10 && /^[6-9]/.test(cleanTo)) {
      cleanTo = '91' + cleanTo;
    }

    let body: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo
    };

    let templateLanguage = options.templateName === 'hello_world' ? 'en_US' : 'en';
    let fallbackLanguage = templateLanguage === 'en_US' ? 'en' : 'en_US';

    switch (options.type) {
      case 'text':
        body.type = 'text';
        body.text = { body: options.text || '' };
        break;

      case 'template':
        body.type = 'template';
        {
          let matched: WhatsAppTemplate | undefined;
          try {
            const templates = await this.syncTemplates();
            const sameName = templates.filter(t => t.name === options.templateName);
            const approved = sameName.filter(t => !t.status || t.status === 'APPROVED');
            matched =
              approved.find(t => t.language === 'en_US') ||
              approved.find(t => t.language === 'en') ||
              approved[0] ||
              sameName[0];
          } catch (e) {
            console.error('[MetaWhatsAppProvider] Failed to sync template body:', e);
          }

          if (matched?.language) {
            templateLanguage = matched.language;
            fallbackLanguage = templateLanguage === 'en_US' ? 'en' : 'en_US';
          }

          body.template = {
            name: options.templateName,
            language: { code: templateLanguage }
          };

          const bodyText = matched?.body || options.templateBody || '';
          const placeholders = [...bodyText.matchAll(/\{\{\s*([^}]+)\s*\}\}/g)].map(m => m[1].trim());
          const namedFromMeta = (matched?.namedParams || []).filter(Boolean);
          const namedFromBody = placeholders.filter(p => /^[A-Za-z][A-Za-z0-9_]*$/.test(p));
          const positionalFromBody = placeholders.filter(p => /^\d+$/.test(p));
          const useNamed = namedFromMeta.length > 0 || (namedFromBody.length > 0 && positionalFromBody.length === 0);
          const expectedNames = useNamed
            ? (namedFromMeta.length > 0 ? namedFromMeta : namedFromBody)
            : placeholders;
          const expectedCount = expectedNames.length;

          const components: any[] = [];

          // Only attach a header when Meta actually defined an IMAGE header
          if (matched?.hasImageHeader) {
            const rawHeader = options.mediaUrl || matched.headerImageUrl || '';
            if (rawHeader && !rawHeader.includes('scontent.whatsapp.net')) {
              components.push({
                type: 'header',
                parameters: [{ type: 'image', image: { link: rawHeader } }]
              });
            }
          }

          if (expectedCount > 0) {
            const incoming = Array.isArray(options.variables) ? options.variables : [];
            const paramList = Array.from({ length: expectedCount }, (_, idx) => {
              const raw = String(incoming[idx] ?? '').replace(/[\r\n]+/g, ' ').trim();
              return raw || '-';
            });
            components.push({
              type: 'body',
              parameters: paramList.map((text, idx) => {
                const param: any = { type: 'text', text };
                if (useNamed) {
                  const name = String(expectedNames[idx] || `var_${idx + 1}`)
                    .toLowerCase()
                    .replace(/[^a-z0-9_]/g, '_')
                    .replace(/^(\d)/, 'v$1');
                  param.parameter_name = name;
                }
                return param;
              })
            });
          }

          if (components.length > 0) {
            body.template.components = components;
          }

          console.log(
            `[MetaWhatsAppProvider] Template ${options.templateName} lang=${templateLanguage} named=${useNamed} vars=${expectedCount}`
          );
        }
        break;

      case 'image':
        body.type = 'image';
        body.image = {
          link: options.mediaUrl,
          caption: options.mediaName || undefined
        };
        break;

      case 'document':
        body.type = 'document';
        body.document = {
          link: options.mediaUrl,
          filename: options.mediaName || 'Document'
        };
        break;

      case 'video':
        body.type = 'video';
        body.video = {
          link: options.mediaUrl,
          caption: options.mediaName || undefined
        };
        break;

      case 'location':
        body.type = 'location';
        body.location = {
          latitude: options.latitude || 0.0,
          longitude: options.longitude || 0.0,
          name: options.mediaName || 'Location'
        };
        break;

      case 'contact':
        body.type = 'contacts';
        body.contacts = [{
          name: {
            formatted_name: options.contactName || 'Contact',
            first_name: options.contactName || 'Contact'
          },
          phones: [{
            phone: options.contactPhone,
            type: 'MOBILE'
          }]
        }];
        break;

      default:
        throw new Error(`Unsupported message type: ${options.type}`);
    }

    console.log(`[MetaWhatsAppProvider] Sending ${options.type} message to ${cleanTo}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });

    let resData = await response.json();
    if (!response.ok) {
      if (options.type === 'template' && resData.error?.code === 132001) {
        console.warn(`[MetaWhatsAppProvider] Template not found in ${templateLanguage}, retrying with ${fallbackLanguage}...`);
        body.template.language.code = fallbackLanguage;
        const retryResponse = await fetch(url, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(body)
        });
        const retryData = await retryResponse.json();
        if (!retryResponse.ok) {
          throw new Error(retryData.error?.message || 'Meta Cloud API message send failed');
        }
        resData = retryData;
      } else {
        throw new Error(resData.error?.message || 'Meta Cloud API message send failed');
      }
    }

    return {
      messageId: resData.messages?.[0]?.id || `wamid-mock-${Date.now()}`,
      status: 'sent'
    };
  }

  async syncTemplates(forceRefresh = false): Promise<WhatsAppTemplate[]> {
    const now = Date.now();
    if (!forceRefresh && this.cachedTemplates && (now - this.lastSyncTime < this.CACHE_TTL_MS)) {
      return this.cachedTemplates;
    }

    const url = `https://graph.facebook.com/v19.0/${this.accountId}/message_templates?fields=name,status,category,language,components`;
    console.log(`[MetaWhatsAppProvider] Syncing templates for account: ${this.accountId}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders()
    });

    const resData = await response.json();
    if (!response.ok) {
      throw new Error(resData.error?.message || 'Failed to sync Meta message templates');
    }

    const rawTemplates = resData.data || [];
    const templates: WhatsAppTemplate[] = rawTemplates.map((t: any) => {
      // Find body and header components
      const bodyComp = t.components?.find((c: any) => c.type === 'BODY');
      const headerComp = t.components?.find((c: any) => c.type === 'HEADER');
      const hasImageHeader = headerComp?.format === 'IMAGE';
      // Extract header image URL from example handle if present
      const headerImageUrl = headerComp?.example?.header_handle?.[0] || '';
      const namedParams = bodyComp?.example?.body_text_named_params?.map((p: any) => p.param_name) || [];

      return {
        id: t.id || `temp-meta-${t.name}`,
        name: t.name,
        body: bodyComp?.text || '',
        hasImageHeader,
        headerImageUrl,
        namedParams,
        status: t.status,
        category: t.category,
        language: t.language,
        created_at: new Date().toISOString()
      };
    });

    this.cachedTemplates = templates;
    this.lastSyncTime = now;
    return templates;
  }

  async createTemplate(template: Omit<WhatsAppTemplate, 'id' | 'created_at'>): Promise<WhatsAppTemplate> {
    const url = `https://graph.facebook.com/v19.0/${this.accountId}/message_templates`;
    
    // Construct standard Meta template request body
    const body = {
      name: template.name.toLowerCase().replace(/[^a-z0-9_]/g, ''),
      category: template.category || 'MARKETING',
      language: template.language || 'en_US',
      components: [
        {
          type: 'BODY',
          text: template.body
        }
      ]
    };

    console.log(`[MetaWhatsAppProvider] Submitting template approval request for: ${body.name}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });

    const resData = await response.json();
    if (!response.ok) {
      throw new Error(resData.error?.message || 'Meta template submission failed');
    }

    return {
      id: resData.id || `temp-meta-${body.name}`,
      name: body.name,
      body: template.body,
      status: 'PENDING',
      category: body.category,
      language: body.language,
      created_at: new Date().toISOString()
    };
  }

  async deleteTemplate(templateName: string): Promise<boolean> {
    const url = `https://graph.facebook.com/v19.0/${this.accountId}/message_templates?name=${templateName}`;
    console.log(`[MetaWhatsAppProvider] Deleting template: ${templateName}`);
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    const resData = await response.json();
    if (!response.ok) {
      throw new Error(resData.error?.message || 'Meta template deletion failed');
    }

    return !!resData.success;
  }
}
