import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { cldUrl, TRANSFORMS } from '@/lib/cloudinary'

export const dynamic = 'force-dynamic'

// Salje mejlove sa liste cekanja. Poziva ga baza (pg_cron, svakog minuta, samo kad ima
// obavestenja koja cekaju). Ruta ne prima nikakve podatke: sama uzima iz baze obavestenja
// koja su vec upisana, pa je bezbedno i kad je pozove neko drugi.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
const resend = new Resend(process.env.RESEND_API_KEY)
const SITE = 'https://tension-barber.rs'
const DAYS = ['nedelja', 'ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota']
const MONTHS = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar']

const esc = (t) => String(t || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const formatDay = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${DAYS[date.getDay()]}, ${d}. ${MONTHS[m - 1]}`
}

function emailHtml({ name, barberName, locationName, date, times, barberId, token }) {
  const buttons = times.map(t => {
    const hhmm = t.slice(0, 5)
    const href = `${SITE}/?b=${barberId}&d=${date}&t=${hhmm}`
    return `<a href="${href}" style="display:inline-block;margin:4px;padding:12px 18px;background:#ffffff;color:#000000;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">${hhmm}</a>`
  }).join('')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#000000;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000;padding:20px 0;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#000000;">
  <tr><td align="center" style="padding:30px 20px 10px;"><img src="${cldUrl('logo/logo.white', TRANSFORMS.logo)}" alt="Tension Barber" width="120" style="display:block;" /></td></tr>
  <tr><td align="center" style="padding:10px 20px 20px;"><h1 style="color:#ffffff;margin:0;font-size:22px;letter-spacing:3px;">TENSION BARBER</h1></td></tr>
  <tr><td align="center" style="padding:0 20px 10px;"><div style="display:inline-block;background-color:#22c55e;color:#ffffff;padding:12px 24px;border-radius:50px;font-size:16px;font-weight:bold;">Oslobodio se termin!</div></td></tr>
  <tr><td style="padding:16px 24px;color:#d4d4d8;font-size:15px;line-height:1.6;text-align:center;">
    Zdravo ${esc(name.split(' ')[0])}, kod berbera <b style="color:#fff;">${esc(barberName)}</b> se oslobodio termin za
    <b style="color:#fff;">${formatDay(date)}</b>.<br>${esc(locationName || '')}
  </td></tr>
  <tr><td align="center" style="padding:6px 16px 10px;">${buttons}</td></tr>
  <tr><td style="padding:6px 24px 20px;color:#a1a1aa;font-size:13px;line-height:1.6;text-align:center;">
    Kliknite na vreme i potvrdite rezervaciju na sajtu. Obaveštenje je stiglo svima sa liste čekanja,
    pa termin dobija onaj ko ga prvi zakaže.
  </td></tr>
  <tr><td align="center" style="padding:10px 20px 30px;color:#71717a;font-size:12px;">
    <a href="${SITE}/api/waitlist-leave?token=${token}" style="color:#71717a;">Ne obaveštavaj me više za ovaj dan</a>
  </td></tr>
</table></td></tr></table></body></html>`
}

async function handle() {
  const { data, error } = await supabaseAdmin.rpc('claim_waitlist_notifications')
  if (error) {
    console.error('Lista cekanja:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  // Jedan mejl po osobi, sa svim terminima koji su se oslobodili
  const byPerson = {}
  for (const row of data || []) {
    const key = `${row.waitlist_id}|${row.slot_date}`
    ;(byPerson[key] ||= { ...row, times: [] }).times.push(row.slot_time)
  }
  let sent = 0
  for (const p of Object.values(byPerson)) {
    const times = [...new Set(p.times)].sort()
    const { error: mailError } = await resend.emails.send({
      from: 'Tension Barber <potvrda@tension-barber.rs>',
      to: p.customer_email,
      subject: `Oslobodio se termin kod ${p.barber_name} (${formatDay(p.slot_date)})`,
      html: emailHtml({
        name: p.customer_name, barberName: p.barber_name, locationName: p.location_name,
        date: p.slot_date, times, barberId: p.barber_id, token: p.token,
      }),
    })
    if (mailError) console.error('Lista cekanja, mejl:', p.customer_email, mailError.message)
    else sent++
  }
  return NextResponse.json({ ok: true, people: Object.keys(byPerson).length, sent })
}

export async function POST() { return handle() }
export async function GET() { return handle() }
