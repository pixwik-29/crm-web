import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isProtectedUser } from '@/lib/protected';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { profileId, newPassword } = body;

    if (!profileId || !newPassword) {
      return NextResponse.json(
        { error: 'Missing required parameters: profileId, newPassword' },
        { status: 400 }
      );
    }

    // Block password reset of protected owner accounts
    if (isProtectedUser(profileId)) {
      return NextResponse.json(
        { error: 'This account is a system owner and its password cannot be reset via this route.' },
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

    // Reset password in Supabase Auth using the admin API
    const { error: resetError } = await supabase.auth.admin.updateUserById(profileId, {
      password: newPassword
    });

    if (resetError) {
      console.error('Error resetting password for auth user:', resetError);
      return NextResponse.json(
        { error: resetError.message || 'Failed to reset user password' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in reset-user-password API route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
