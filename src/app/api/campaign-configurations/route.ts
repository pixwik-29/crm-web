import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const getSupabase = () => {
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Database configuration missing');
  }
  return createClient(supabaseUrl, serviceKey);
};

// GET /api/campaign-configurations?tenantId=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('campaign_configurations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, configs: data || [] });
  } catch (error: any) {
    console.error('[CampaignConfigs GET] Failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/campaign-configurations
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId, campaignKey, customName, welcomeTemplateName } = body;

    if (!tenantId || !campaignKey || !customName) {
      return NextResponse.json({ error: 'tenantId, campaignKey, and customName are required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('campaign_configurations')
      .upsert({
        tenant_id: tenantId,
        campaign_key: campaignKey,
        custom_name: customName,
        welcome_template_name: welcomeTemplateName || null
      }, { onConflict: 'campaign_key,tenant_id' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, config: data });
  } catch (error: any) {
    console.error('[CampaignConfigs POST] Failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/campaign-configurations
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const tenantId = searchParams.get('tenantId');

    if (!id || !tenantId) {
      return NextResponse.json({ error: 'id and tenantId are required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from('campaign_configurations')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[CampaignConfigs DELETE] Failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
