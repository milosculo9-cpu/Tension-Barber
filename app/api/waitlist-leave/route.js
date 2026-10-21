import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const page = (title, text) => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title} - Tension Barber</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-family:Arial,sans-serif;text-align:center;padding:24px;">
<div><h1 style="letter-spacing:3px;font-size:20px;margin:0 0 16px;">TENSION BARBER</h1><p style="font-size:18px;margin:0 0 8px;">${title}</p>
<p style="color:#a1a1aa;margin:0 0 24px;">${text}</p><a href="https://tension-barber.rs" style="color:#fff;">Nazad na sajt</a></div></body></html>`

// Odjava sa liste cekanja preko linka iz mejla
export async function GET(request) {
  const token = new URL(request.url).searchParams.get('token')
  let ok = false
  if (token && /^[0-9a-f-]{36}$/i.test(token)) {
    const { data } = await supabase.rpc('leave_waitlist', { p_token: token })
    ok = !!data
  }
  const html = ok
    ? page('Odjavljeni ste sa liste čekanja', 'Za ovaj dan Vam više nećemo slati obaveštenja.')
    : page('Već ste odjavljeni', 'Ova prijava na listu čekanja više nije aktivna.')
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
