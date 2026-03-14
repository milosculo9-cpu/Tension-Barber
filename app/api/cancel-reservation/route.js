import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const resend = new Resend(process.env.RESEND_API_KEY)

function renderHTML(status, message) {
  const isSuccess = status === 'success'
  const isAlready = status === 'already'
  const color = isSuccess ? '#22c55e' : isAlready ? '#f59e0b' : '#ef4444'
  const icon = isSuccess ? '✓' : isAlready ? '⚠' : '✕'
  const title = isSuccess ? 'Otkazano!' : isAlready ? 'Već otkazano' : 'Greška'

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + title + ' - Tension Barber</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background-color:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}.container{max-width:400px;text-align:center}.logo{font-size:24px;font-weight:bold;letter-spacing:3px;margin-bottom:40px;color:#888}.icon{font-size:64px;margin-bottom:20px;color:' + color + '}.title{font-size:28px;font-weight:bold;margin-bottom:15px;color:' + color + '}.message{font-size:16px;color:#888;margin-bottom:30px}.button{display:inline-block;background:#fff;color:#000;padding:15px 30px;text-decoration:none;font-weight:bold;border-radius:8px}</style></head><body><div class="container"><div class="logo">TENSION BARBER</div><div class="icon">' + icon + '</div><div class="title">' + title + '</div><div class="message">' + message + '</div><a href="https://tension-barber.rs" class="button">Nazad na sajt</a></div></body></html>'
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return new Response(renderHTML('error', 'Neispravan link za otkazivanje.'), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    const { data: appointment, error: findError } = await supabase
      .from('appointments')
      .select('*, barber:barbers(id, name, email)')
      .eq('cancellation_token', token)
      .single()

    if (findError || !appointment) {
      return new Response(renderHTML('error', 'Rezervacija nije pronađena ili je link istekao.'), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    if (appointment.status === 'cancelled') {
      return new Response(renderHTML('already', 'Ova rezervacija je već otkazana.'), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    const appointmentDateTime = new Date(appointment.appointment_date + 'T' + appointment.appointment_time)
    if (appointmentDateTime < new Date()) {
      return new Response(renderHTML('error', 'Ne možete otkazati termin koji je već prošao.'), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    const { error: updateError } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointment.id)

    if (updateError) {
      console.error('Update error:', updateError)
      return new Response(renderHTML('error', 'Greška pri otkazivanju. Pokušajte ponovo.'), {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    await supabase
      .from('barber_available_slots')
      .update({ is_booked: false })
      .eq('barber_id', appointment.barber_id)
      .eq('slot_date', appointment.appointment_date)
      .eq('slot_time', appointment.appointment_time)

    if (appointment.duration_minutes === 60) {
      const timeParts = appointment.appointment_time.split(':')
      const hours = parseInt(timeParts[0])
      const minutes = parseInt(timeParts[1])
      let totalMinutes = hours * 60 + minutes + 30
      const nextHours = Math.floor(totalMinutes / 60)
      const nextMinutes = totalMinutes % 60
      const nextSlotTime = String(nextHours).padStart(2, '0') + ':' + String(nextMinutes).padStart(2, '0') + ':00'

      await supabase
        .from('barber_available_slots')
        .update({ is_booked: false })
        .eq('barber_id', appointment.barber_id)
        .eq('slot_date', appointment.appointment_date)
        .eq('slot_time', nextSlotTime)
    }

    if (appointment.barber && appointment.barber.email) {
      const dateObj = new Date(appointment.appointment_date)
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
      const formattedDate = dateObj.toLocaleDateString('sr-RS', options)
      const formattedTime = appointment.appointment_time.slice(0, 5)

      await resend.emails.send({
        from: 'Tension Barber <potvrda@tension-barber.rs>',
        to: appointment.barber.email,
        subject: '❌ Otkazana rezervacija - ' + formattedDate + ' u ' + formattedTime,
        html: '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background-color:#000000;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000;padding:20px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;background-color:#000000;"><tr><td style="padding:30px 20px;text-align:center;"><h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:bold;letter-spacing:3px;">TENSION BARBER</h1></td></tr><tr><td style="padding:20px;text-align:center;"><p style="color:#ef4444;margin:0;font-size:48px;line-height:1;">✕</p><p style="color:#ef4444;margin:12px 0 0;font-size:18px;font-weight:600;">Rezervacija otkazana</p></td></tr><tr><td style="padding:10px 20px 20px;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border-radius:12px;overflow:hidden;"><tr><td style="padding:15px 20px;border-bottom:1px solid #333;"><p style="color:#888;margin:0 0 5px;font-size:12px;text-transform:uppercase;">Klijent</p><p style="color:#fff;margin:0;font-size:16px;font-weight:bold;">' + appointment.customer_name + '</p></td></tr><tr><td style="padding:15px 20px;border-bottom:1px solid #333;"><p style="color:#888;margin:0 0 5px;font-size:12px;text-transform:uppercase;">Usluga</p><p style="color:#fff;margin:0;font-size:16px;font-weight:bold;">' + appointment.service_name + '</p></td></tr><tr><td style="padding:15px 20px;border-bottom:1px solid #333;"><p style="color:#888;margin:0 0 5px;font-size:12px;text-transform:uppercase;">Datum</p><p style="color:#fff;margin:0;font-size:16px;font-weight:bold;">' + formattedDate + '</p></td></tr><tr><td style="padding:15px 20px;"><p style="color:#888;margin:0 0 5px;font-size:12px;text-transform:uppercase;">Vreme</p><p style="color:#fff;margin:0;font-size:24px;font-weight:bold;">' + formattedTime + '</p></td></tr></table></td></tr><tr><td style="padding:20px;text-align:center;"><p style="color:#22c55e;margin:0;font-size:14px;font-weight:600;">✓ Termin je ponovo slobodan za zakazivanje</p></td></tr></table></td></tr></table></body></html>'
      })
    }

    return new Response(renderHTML('success', 'Vaša rezervacija je uspešno otkazana.'), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })

  } catch (error) {
    console.error('Cancel error:', error)
    return new Response(renderHTML('error', 'Došlo je do greške. Pokušajte ponovo.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }
}
