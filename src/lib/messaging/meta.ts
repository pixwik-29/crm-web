import { IMessagingProvider, SendMessageOptions, WhatsAppTemplate } from './types';

export class MetaWhatsAppProvider implements IMessagingProvider {
  private apiToken: string;
  private phoneId: string;
  private accountId: string;

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
    let body: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: options.to
    };

    const primaryLanguage = options.templateName === 'hello_world' ? 'en_US' : 'en';
    const secondaryLanguage = primaryLanguage === 'en_US' ? 'en' : 'en_US';

    switch (options.type) {
      case 'text':
        body.type = 'text';
        body.text = { body: options.text || '' };
        break;

      case 'template':
        body.type = 'template';
        body.template = {
          name: options.templateName,
          language: { code: primaryLanguage }
        };
        if (options.variables && options.variables.length > 0) {
          let bodyText = options.templateBody || '';
          if (!bodyText && options.templateName) {
            try {
              const templates = await this.syncTemplates();
              const matched = templates.find(t => t.name === options.templateName);
              if (matched) {
                bodyText = matched.body;
              }
            } catch (e) {
              console.error('[MetaWhatsAppProvider] Failed to sync template body:', e);
            }
          }
          const placeholders = [...bodyText.matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1]);

          body.template.components = [
            {
              type: 'body',
              parameters: options.variables.map((v, idx) => {
                const paramName = placeholders[idx];
                const isNumeric = paramName && /^\d+$/.test(paramName);
                if (paramName && !isNumeric) {
                  return {
                    type: 'text',
                    text: v,
                    parameter_name: paramName
                  };
                } else {
                  return {
                    type: 'text',
                    text: v
                  };
                }
              })
            }
          ];
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

    console.log(`[MetaWhatsAppProvider] Sending ${options.type} message to ${options.to}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });

    let resData = await response.json();
    if (!response.ok) {
      if (options.type === 'template' && resData.error?.code === 132001) {
        console.warn(`[MetaWhatsAppProvider] Template not found in ${primaryLanguage}, retrying with ${secondaryLanguage}...`);
        body.template.language.code = secondaryLanguage;
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

  async syncTemplates(): Promise<WhatsAppTemplate[]> {
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
    return rawTemplates.map((t: any) => {
      // Find the body component to extract body text
      const bodyComp = t.components?.find((c: any) => c.type === 'BODY');
      return {
        id: t.id || `temp-meta-${t.name}`,
        name: t.name,
        body: bodyComp?.text || '',
        status: t.status,
        category: t.category,
        language: t.language,
        created_at: new Date().toISOString()
      };
    });
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
