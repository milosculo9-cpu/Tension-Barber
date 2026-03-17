import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request) {
  try {
    const { action, email, password, barberId, name, locationId } = await request.json();

    if (action === 'create') {
      // Create new auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }

      // Create barber record linked to auth user
      const { data: barberData, error: barberError } = await supabaseAdmin
        .from('barbers')
        .insert({
          name,
          location_id: locationId,
          auth_user_id: authData.user.id,
          is_admin: false
        })
        .select()
        .single();

      if (barberError) {
        // Rollback: delete auth user if barber creation fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return NextResponse.json({ error: barberError.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, barber: barberData });

    } else if (action === 'update') {
      // Get barber's auth_user_id
      const { data: barber } = await supabaseAdmin
        .from('barbers')
        .select('auth_user_id')
        .eq('id', barberId)
        .single();

      if (!barber?.auth_user_id) {
        return NextResponse.json({ error: 'Berber nema povezan nalog' }, { status: 400 });
      }

      // Update auth user
      const updateData = {};
      if (email) updateData.email = email;
      if (password) updateData.password = password;

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        barber.auth_user_id,
        updateData
      );

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error managing barber auth:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
