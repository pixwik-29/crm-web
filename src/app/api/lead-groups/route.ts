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

// GET /api/lead-groups?tenantId=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('lead_groups')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, groups: data });
  } catch (error: any) {
    console.error('[LeadGroups GET] Failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/lead-groups
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId, name, description, filters } = body;

    if (!tenantId || !name) {
      return NextResponse.json({ error: 'tenantId and name are required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('lead_groups')
      .insert({
        tenant_id: tenantId,
        name,
        description: description || null,
        filters: filters || {}
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, group: data });
  } catch (error: any) {
    console.error('[LeadGroups POST] Failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/lead-groups
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, tenantId, name, description, filters } = body;

    if (!id || !tenantId) {
      return NextResponse.json({ error: 'id and tenantId are required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('lead_groups')
      .update({
        name,
        description: description || null,
        filters: filters || {}
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, group: data });
  } catch (error: any) {
    console.error('[LeadGroups PUT] Failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/lead-groups
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
      .from('lead_groups')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[LeadGroups DELETE] Failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
