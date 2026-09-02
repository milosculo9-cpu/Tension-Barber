import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Tabele koje drze redove po berberu, a nisu deo osnovne seme (nemaju ON DELETE CASCADE).
// Brisu se pre samog berbera; tabela koja ne postoji se preskace.
const DEPENDENT_TABLES = [
  'barber_available_slots',
  'barber_slot_settings',
  'barber_day_locks',
  'barber_time_off',
  'barber_schedules',
];

// Samo ulogovani admin sme da poziva ovu rutu
async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: 'Niste ulogovani', status: 401 };

  const { data: me } = await supabaseAdmin
    .from('barbers')
    .select('id, is_admin')
    .eq('auth_user_id', session.user.id)
    .maybeSingle();

  if (!me?.is_admin) return { error: 'Samo admin može da upravlja nalozima', status: 403 };
  return { me };
}

export async function POST(request) {
  try {
    const guard = await requireAdmin();
    if (guard.error) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

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

    } else if (action === 'delete') {
      const { data: barber, error: barberError } = await supabaseAdmin
        .from('barbers')
        .select('id, name, is_admin, auth_user_id')
        .eq('id', barberId)
        .single();

      if (barberError || !barber) {
        return NextResponse.json({ error: 'Berber nije pronađen' }, { status: 404 });
      }
      if (barber.is_admin) {
        return NextResponse.json({ error: 'Admin nalog ne može da se obriše iz panela' }, { status: 400 });
      }
      if (barber.id === guard.me.id) {
        return NextResponse.json({ error: 'Ne možete obrisati sopstveni nalog' }, { status: 400 });
      }

      // 1) Login nalog: berber vise ne moze da se uloguje
      if (barber.auth_user_id) {
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(barber.auth_user_id);
        if (authDeleteError && !/not found/i.test(authDeleteError.message)) {
          return NextResponse.json({ error: `Brisanje login naloga nije uspelo: ${authDeleteError.message}` }, { status: 400 });
        }
      }

      // 2) Slotovi, podesavanja, zakljucani dani, raspored, slobodni dani
      for (const table of DEPENDENT_TABLES) {
        const { error } = await supabaseAdmin.from(table).delete().eq('barber_id', barber.id);
        if (error && error.code !== '42P01' && !/does not exist|schema cache/i.test(error.message)) {
          return NextResponse.json({ error: `Brisanje iz tabele ${table} nije uspelo: ${error.message}` }, { status: 400 });
        }
      }

      // 3) Termini: ako ih ima, istorija se cuva, a berber se samo deaktivira i odvezuje od naloga.
      //    Ako termina nema, red se brise u potpunosti.
      const { count: appointmentCount } = await supabaseAdmin
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('barber_id', barber.id);

      if (appointmentCount > 0) {
        const { error: deactivateError } = await supabaseAdmin
          .from('barbers')
          .update({ is_active: false, auth_user_id: null })
          .eq('id', barber.id);
        if (deactivateError) {
          return NextResponse.json({ error: deactivateError.message }, { status: 400 });
        }
        return NextResponse.json({ success: true, mode: 'deactivated', appointments: appointmentCount });
      }

      const { error: deleteError } = await supabaseAdmin
        .from('barbers')
        .delete()
        .eq('id', barber.id);
      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, mode: 'deleted' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error managing barber auth:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
