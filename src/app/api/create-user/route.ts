import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PROTECTED_EMAILS } from '@/lib/protected';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, role, phone, tenant_id } = body;

    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { error: 'Missing required parameters: email, password, name, role' },
        { status: 400 }
      );
    }

    // Block re-creation or modification of protected owner accounts via this route
    if (PROTECTED_EMAILS.has(email.toLowerCase())) {
      return NextResponse.json(
        { error: 'This email belongs to a protected system owner account and cannot be created or modified via this route.' },
        { status: 403 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase credentials not configured in environment variables' },
        { status: 500 }
      );
    }

    // Initialize the Admin/Service client to bypass RLS and perform auth actions
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify phone number uniqueness in profiles table (if provided)
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      const last10 = cleanPhone.slice(-10);
      const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+91${cleanPhone}`;

      const { data: existingProfile, error: phoneCheckError } = await supabase
        .from('profiles')
        .select('id, phone')
        .or(`phone.eq.${formattedPhone},phone.ilike.%${last10}%`);

      if (phoneCheckError) {
        console.error('Phone check error:', phoneCheckError);
      } else if (existingProfile && existingProfile.length > 0) {
        return NextResponse.json(
          { error: 'A user account with this mobile phone number already exists.' },
          { status: 400 }
        );
      }
    }

    // 1. Create the user in Supabase Auth using the admin API
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email so they can log in immediately
      user_metadata: {
        full_name: name,
        role,
        phone,
        tenant_id: tenant_id || 'default'
      }
    });

    if (createError) {
      console.error('Error creating auth user:', createError);
      return NextResponse.json(
        { error: createError.message || 'Failed to create auth user' },
        { status: 500 }
      );
    }

    const userId = userData.user?.id;

    // 2. Double check if the trigger created the profile, otherwise insert it manually
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      console.log('Profile not created automatically by trigger, inserting manually...');
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          full_name: name,
          role,
          phone,
          tenant_id: tenant_id || 'default',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error inserting profile manually:', insertError);
      }
    } else {
      console.log('Profile created by trigger, updating fields to ensure sync with tenant_id:', tenant_id);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: name,
          role,
          phone,
          tenant_id: tenant_id || 'default',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating profile fields:', updateError.message);
      }
    }

    return NextResponse.json({ success: true, user: userData.user });
  } catch (error: any) {
    console.error('Error in create-user API route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
