import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { profileId } = body;

    if (!profileId) {
      return NextResponse.json(
        { error: 'Missing required parameter: profileId' },
        { status: 400 }
      );
    }

    // Block deletion of the primary super admin account
    const SUPER_ADMIN_ID = 'c19202d7-9967-468d-bf87-0f90815024b1';
    if (profileId === SUPER_ADMIN_ID) {
      return NextResponse.json(
        { error: 'This account is the primary super admin / system owner and cannot be deleted.' },
        { status: 403 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase credentials not configured in environment variables' },
        { status: 550 }
      );
    }

    // Initialize the Admin/Service client to bypass RLS and perform auth actions
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Delete the user from Supabase Auth using the admin API
    // Since profiles has ON DELETE CASCADE referencing auth.users, deleting the auth user
    // will automatically delete their profile row!
    const { error: deleteError } = await supabase.auth.admin.deleteUser(profileId);

    if (deleteError) {
      console.error('Error deleting auth user:', deleteError);
      
      // Fallback: If the user is not found in Auth but the profile row is present, delete profile directly
      const { error: profileDeleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profileId);

      if (profileDeleteError) {
        return NextResponse.json(
          { error: deleteError.message || 'Failed to delete user profile' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in delete-user API route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
