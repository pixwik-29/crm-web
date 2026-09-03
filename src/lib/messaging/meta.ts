import { IMessagingProvider, SendMessageOptions, WhatsAppTemplate } from './types';

export class MetaWhatsAppProvider implements IMessagingProvider {
  private apiToken: string;
  private phoneId: string;
  private accountId: string;
  private cachedTemplates: WhatsAppTemplate[] | null = null;
  private lastSyncTime: number = 0;
  private CACHE_TTL_MS: number = 5 * 60 * 1000; // 5 minute cache
  private DEFAULT_HEADER_IMAGE = 'https://partner.perfectscholar.com/logo.png';

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

  private sanitizeParamText(value: string): string {
    return String(value ?? '').replace(/[\r\n]+/g, ' ').trim() || '-';
  }

  private publicMediaUrl(...candidates: Array<string | undefined>): string {
    return candidates.find((url) => {
      const value = String(url || '').trim();
      return /^https:\/\//i.test(value) && !value.includes('scontent.whatsapp.net');
    }) || this.DEFAULT_HEADER_IMAGE;
  }

  private placeholdersIn(text?: string): string[] {
    return [...String(text || '').matchAll(/\{\{\s*([^}]+)\s*\}\}/g)].map((m) => m[1].trim());
  }

  private shouldUseNamed(matched?: WhatsAppTemplate, _bodyText = ''): boolean {
    const format = String(matched?.parameterFormat || '').toUpperCase();
    if (format === 'NAMED') return true;
    if (format === 'POSITIONAL') return false;
    if ((matched?.namedParams || []).length > 0) return true;
    // Meta defaults to positional. Guessing named from local {{name}} tags caused 132012.
    return false;
  }

  private namedParam(raw: string, idx: number): string {
    const cleaned = String(raw || '')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '');
    if (/^[a-z][a-z0-9_]*$/.test(cleaned)) return cleaned;
    return `var_${idx + 1}`;
  }

  private buildTemplateComponents(
    options: SendMessageOptions,
    matched: WhatsAppTemplate | undefined,
    useNamed: boolean
  ): any[] {
    const bodyText = matched?.body || options.templateBody || '';
    const placeholders = this.placeholdersIn(bodyText);
    const namedFromMeta = (matched?.namedParams || []).filter(Boolean);
    const expectedNames = useNamed
      ? (namedFromMeta.length > 0 ? namedFromMeta : placeholders.filter((p) => /^[A-Za-z]/.test(p)))
      : placeholders;
    const expectedCount = useNamed
      ? (expectedNames.length || placeholders.length)
      : placeholders.length;

    const incoming = Array.isArray(options.variables) ? options.variables : [];
    const bodyValues = Array.from({ length: expectedCount }, (_, idx) =>
      this.sanitizeParamText(incoming[idx] ?? '')
    );
    const components: any[] = [];
    const headerFormat = matched?.headerFormat;

    if (headerFormat === 'IMAGE' || matched?.hasImageHeader) {
      components.push({
        type: 'header',
        parameters: [{
          type: 'image',
          image: { link: this.publicMediaUrl(options.mediaUrl, matched?.headerImageUrl) }
        }]
      });
    } else if (headerFormat === 'VIDEO') {
      const link = this.publicMediaUrl(options.mediaUrl, matched?.headerImageUrl);
      components.push({
        type: 'header',
        parameters: [{ type: 'video', video: { link } }]
      });
    } else if (headerFormat === 'DOCUMENT') {
      const link = this.publicMediaUrl(options.mediaUrl, matched?.headerImageUrl);
      components.push({
        type: 'header',
        parameters: [{ type: 'document', document: { link, filename: options.mediaName || 'document.pdf' } }]
      });
    } else if (headerFormat === 'TEXT') {
      const headerVars = this.placeholdersIn(matched?.headerText);
      if (headerVars.length > 0) {
        const text = this.sanitizeParamText(incoming[0] || '');
        const param: any = { type: 'text', text };
        if (useNamed) param.parameter_name = this.namedParam(headerVars[0], 0);
        components.push({ type: 'header', parameters: [param] });
      }
    }

    if (expectedCount > 0) {
      components.push({
        type: 'body',
        parameters: bodyValues.map((text, idx) => {
          const param: any = { type: 'text', text };
          if (useNamed) {
            param.parameter_name = this.namedParam(expectedNames[idx] || placeholders[idx], idx);
          }
          return param;
        })
      });
    }

    return components;
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
    let matchedTemplate: WhatsAppTemplate | undefined;
    let usedNamed = false;

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

          const bodyText = matched?.body || options.templateBody || '';
          let useNamed = this.shouldUseNamed(matched, bodyText);
          const components = this.buildTemplateComponents(options, matched, useNamed);
          matchedTemplate = matched;
          usedNamed = useNamed;

          body.template = {
            name: options.templateName,
            language: { code: templateLanguage }
          };
          if (components.length > 0) {
            body.template.components = components;
          }

          console.log(
            `[MetaWhatsAppProvider] Template ${options.templateName} lang=${templateLanguage} format=${matched?.parameterFormat || 'guess'} named=${useNamed} header=${matched?.headerFormat || 'none'}`
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
          throw new Error(retryData.error?.error_data?.details || retryData.error?.message || 'Meta Cloud API message send failed');
        }
        resData = retryData;
      } else if (options.type === 'template' && resData.error?.code === 132012) {
        const details = String(resData.error?.error_data?.details || resData.error?.message || '');
        const flipped = !usedNamed;
        let retryMatched = matchedTemplate;
        if (/IMAGE/i.test(details)) {
          retryMatched = {
            ...(matchedTemplate || { id: '', name: options.templateName || '', body: options.templateBody || '', created_at: '' }),
            hasImageHeader: true,
            headerFormat: 'IMAGE',
          };
        }
        console.warn(
          `[MetaWhatsAppProvider] 132012 format mismatch. Retrying as ${flipped ? 'named' : 'positional'} parameters. details=${details}`
        );
        const retryComponents = this.buildTemplateComponents(options, retryMatched, flipped);
        body.template.components = retryComponents.length > 0 ? retryComponents : undefined;
        const retryResponse = await fetch(url, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(body)
        });
        const retryData = await retryResponse.json();
        if (!retryResponse.ok) {
          throw new Error(
            retryData.error?.error_data?.details ||
            retryData.error?.message ||
            resData.error?.error_data?.details ||
            resData.error?.message ||
            'Meta Cloud API message send failed'
          );
        }
        resData = retryData;
      } else {
        throw new Error(resData.error?.error_data?.details || resData.error?.message || 'Meta Cloud API message send failed');
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

    const rawTemplates: any[] = [];
    let pageUrl: string | undefined = `https://graph.facebook.com/v21.0/${this.accountId}/message_templates?fields=name,status,category,language,components,parameter_format&limit=100`;
    console.log(`[MetaWhatsAppProvider] Syncing templates for account: ${this.accountId}`);

    while (pageUrl) {
      const requestUrl: string = pageUrl;
      const pageResponse: Response = await fetch(requestUrl, {
        method: 'GET',
        headers: this.getHeaders()
      });
      const pageData: {
        error?: { message?: string };
        data?: any[];
        paging?: { next?: string };
      } = await pageResponse.json();
      if (!pageResponse.ok) {
        throw new Error(pageData.error?.message || 'Failed to sync Meta message templates');
      }
      rawTemplates.push(...(pageData.data || []));
      pageUrl = pageData.paging?.next;
    }

    const templates: WhatsAppTemplate[] = rawTemplates.map((t: any) => {
      const bodyComp = t.components?.find((c: any) => c.type === 'BODY');
      const headerComp = t.components?.find((c: any) => c.type === 'HEADER');
      const buttonsComp = t.components?.find((c: any) => c.type === 'BUTTONS');
      const headerFormat = headerComp?.format as WhatsAppTemplate['headerFormat'] | undefined;
      const namedParams = bodyComp?.example?.body_text_named_params?.map((p: any) => p.param_name) || [];
      const urlButtonIndexes = (buttonsComp?.buttons || [])
        .map((btn: any, index: number) =>
          btn?.type === 'URL' && String(btn.url || '').includes('{{') ? index : -1
        )
        .filter((index: number) => index >= 0);

      return {
        id: t.id || `temp-meta-${t.name}`,
        name: t.name,
        body: bodyComp?.text || '',
        hasImageHeader: headerFormat === 'IMAGE',
        headerFormat,
        headerText: headerComp?.text || '',
        headerImageUrl: headerComp?.example?.header_handle?.[0] || '',
        parameterFormat: String(t.parameter_format || '').toUpperCase() as WhatsAppTemplate['parameterFormat'],
        namedParams,
        urlButtonIndexes,
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
