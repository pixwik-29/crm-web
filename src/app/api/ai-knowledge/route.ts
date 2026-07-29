import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export interface CustomKnowledgeItem {
  id: string;
  title: string;
  category: 'visa' | 'scholarship' | 'faq' | 'documents' | 'general' | string;
  content: string;
  created_at: string;
  file_name?: string;
}

// In-memory persistent cache fallback for seamless performance
let memoryKnowledgeStore: CustomKnowledgeItem[] = [
  {
    id: 'kb-default-1',
    title: 'General Visa & Immigration Process',
    category: 'visa',
    content: 'Visa Application Requirements:\n1. Original Passport valid for minimum 18 months.\n2. Admission Letter & Ministry Approval from destination country.\n3. 10th & 12th Marksheets with Apostille / Legalization.\n4. Medical fitness certificate & HIV negative report.\n5. 12 Passport size photos with white background.\n6. Bank statement showing sufficient balance for living expenses.',
    created_at: new Date().toISOString()
  },
  {
    id: 'kb-default-2',
    title: 'Educational Loans & Financing Options',
    category: 'scholarship',
    content: 'Educational Loan Guidance:\n1. Nationalized Banks (SBI, Canara, BoB) provide education loans up to ₹25-40 Lakhs for MBBS abroad.\n2. Perfect Scholar provides official Admission Letter, Bonafide Certificate, and Fee Structure breakdown required by banks for loan processing.\n3. Collateral-free loans up to ₹7.5 Lakhs available under Vidya Lakshmi scheme.',
    created_at: new Date().toISOString()
  }
];

// GET /api/ai-knowledge — Retrieve custom knowledge items
export async function GET(req: NextRequest) {
  try {
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ items: memoryKnowledgeStore });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: announcements } = await supabase
      .from('partner_announcements')
      .select('*')
      .eq('type', 'kb_item')
      .order('created_at', { ascending: false });

    if (announcements && announcements.length > 0) {
      const items: CustomKnowledgeItem[] = announcements.map(a => ({
        id: a.id,
        title: a.title,
        category: a.category || 'general',
        content: a.content || a.message || '',
        created_at: a.created_at,
        file_name: a.file_name
      }));
      return NextResponse.json({ items });
    }

    return NextResponse.json({ items: memoryKnowledgeStore });
  } catch (err: any) {
    return NextResponse.json({ items: memoryKnowledgeStore });
  }
}

// POST /api/ai-knowledge — Add new custom knowledge item or file text
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, category = 'general', content, fileName, tenantId = 'nash-pixwik-admin' } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const newItem: CustomKnowledgeItem = {
      id: `kb-${Date.now()}`,
      title: title.trim(),
      category,
      content: content.trim(),
      created_at: new Date().toISOString(),
      file_name: fileName
    };

    memoryKnowledgeStore.unshift(newItem);

    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);
      await supabase.from('partner_announcements').insert({
        title: newItem.title,
        message: newItem.content,
        content: newItem.content,
        type: 'kb_item',
        category: newItem.category,
        file_name: fileName || null,
        created_at: newItem.created_at
      });
    }

    return NextResponse.json({ success: true, item: newItem });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save knowledge item' }, { status: 500 });
  }
}

// DELETE /api/ai-knowledge — Delete knowledge item by ID
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID parameter is required' }, { status: 400 });
    }

    memoryKnowledgeStore = memoryKnowledgeStore.filter(item => item.id !== id);

    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);
      await supabase.from('partner_announcements').delete().eq('id', id);
    }

    return NextResponse.json({ success: true, message: 'Knowledge item deleted' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete item' }, { status: 500 });
  }
}

/**
 * Internal helper function to fetch custom knowledge items for RAG engine
 */
export async function fetchCustomKnowledgeItems(): Promise<CustomKnowledgeItem[]> {
  try {
    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data: announcements } = await supabase
        .from('partner_announcements')
        .select('*')
        .eq('type', 'kb_item')
        .order('created_at', { ascending: false });

      if (announcements && announcements.length > 0) {
        return announcements.map(a => ({
          id: a.id,
          title: a.title,
          category: a.category || 'general',
          content: a.content || a.message || '',
          created_at: a.created_at,
          file_name: a.file_name
        }));
      }
    }
  } catch (e) {
    // fallback to memory
  }
  return memoryKnowledgeStore;
}
