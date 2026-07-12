import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MessagingService } from '@/lib/messaging/service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// GET /api/whatsapp/templates — sync templates from Meta and return local list
export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenant_id') || 'default';
    
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Fetch provider for the current tenant
    const provider = await MessagingService.getProviderForTenant(tenantId);
    
    // 2. Fetch templates from Meta API
    console.log(`[Templates API] Syncing templates from Meta for tenant ${tenantId}...`);
    const metaTemplates = await provider.syncTemplates();

    // 3. Persist the fetched templates in our local database for fast lookup and offline access
    if (metaTemplates.length > 0) {
      const dbTemplates = metaTemplates.map(t => ({
        name: t.name,
        body: t.body,
        attachment_url: t.attachment_url || null,
        attachment_name: t.attachment_name || null,
        tenant_id: tenantId,
        // Sync custom columns if they exist in schema (or let them fall back)
      }));

      // In multi-tenant settings, we try to upsert based on (name, tenant_id)
      let { error: upsertErr } = await supabase
        .from('whatsapp_templates')
        .upsert(dbTemplates, { onConflict: 'name,tenant_id' });

      // If we hit error 42P10 (no unique constraint on name, tenant_id), perform manual fallback upsert
      if (upsertErr && upsertErr.code === '42P10') {
        console.warn('[Templates API] Missing unique constraint, executing manual fallback sync...');
        
        // Fetch current local templates to avoid duplicate primary key errors
        const { data: existingLocal } = await supabase
          .from('whatsapp_templates')
          .select('id, name')
          .eq('tenant_id', tenantId);
          
        const localMap = new Map(existingLocal?.map(t => [t.name, t.id]) || []);
        
        for (const t of dbTemplates) {
          const existingId = localMap.get(t.name);
          if (existingId) {
            // Update
            await supabase
              .from('whatsapp_templates')
              .update({
                body: t.body,
                attachment_url: t.attachment_url,
                attachment_name: t.attachment_name
              })
              .eq('id', existingId);
          } else {
            // Insert
            await supabase
              .from('whatsapp_templates')
              .insert(t);
          }
        }
        upsertErr = null; // Clear error as fallback was successful
      }

      if (upsertErr) {
        console.warn('[Templates API] Failed to cache templates in DB:', upsertErr.message);
      }
    }

    // 4. Return templates from DB to preserve local metadata
    const { data: localTemplates, error: fetchErr } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('tenant_id', tenantId);

    if (fetchErr) throw new Error(fetchErr.message);

    return NextResponse.json({ success: true, templates: localTemplates || [] });
  } catch (error: any) {
    console.error('[Templates API] GET Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/whatsapp/templates — submit template to Meta for approval
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, bodyText, category, language, tenantId = 'default' } = body;

    if (!name || !bodyText) {
      return NextResponse.json({ error: 'Template name and body content are required' }, { status: 400 });
    }

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Fetch provider
    const provider = await MessagingService.getProviderForTenant(tenantId);

    // 2. Create on Meta
    console.log(`[Templates API] Creating template on Meta: ${name}`);
    const createdMetaTemplate = await provider.createTemplate({
      name,
      body: bodyText,
      category: category || 'MARKETING',
      language: language || 'en_US'
    });

    // 3. Save locally in DB
    const { data: newDbTemplate, error: dbErr } = await supabase
      .from('whatsapp_templates')
      .insert([{
        name: createdMetaTemplate.name,
        body: createdMetaTemplate.body,
        tenant_id: tenantId
      }])
      .select()
      .single();

    if (dbErr) throw new Error(dbErr.message);

    return NextResponse.json({ success: true, template: newDbTemplate }, { status: 201 });
  } catch (error: any) {
    console.error('[Templates API] POST Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/whatsapp/templates — delete template from Meta and locally
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const name = searchParams.get('name');
    const tenantId = searchParams.get('tenant_id') || 'default';

    if (!name) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Fetch provider
    const provider = await MessagingService.getProviderForTenant(tenantId);

    // 2. Delete on Meta
    console.log(`[Templates API] Deleting template on Meta: ${name}`);
    await provider.deleteTemplate(name);

    // 3. Delete locally
    const { error: deleteErr } = await supabase
      .from('whatsapp_templates')
      .delete()
      .eq('name', name)
      .eq('tenant_id', tenantId);

    if (deleteErr) throw new Error(deleteErr.message);

    return NextResponse.json({ success: true, message: `Template ${name} deleted successfully` });
  } catch (error: any) {
    console.error('[Templates API] DELETE Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
