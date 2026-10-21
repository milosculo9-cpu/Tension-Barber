'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// Prijava na listu cekanja sa sajta: kad se kod berbera oslobodi termin tog dana
// (u izabranom vremenu), klijent dobija mejl sa dugmetom za zakazivanje.
const HOURS = Array.from({ length: 15 }, (_, i) => `${String(8 + i).padStart(2, '0')}:00`)

export default function WaitlistForm({ barber, date, initial, onClose }) {
  const [name, setName] = useState(initial?.name || '')
  const [phone, setPhone] = useState(initial?.phone || '')
  const [email, setEmail] = useState(initial?.email || '')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [consent, setConsent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if ((phone || '').replace(/\D/g, '').length < 9) { setError('Upišite ispravan broj telefona.'); return }
    if (from && to && from > to) { setError('Vreme "od" mora biti pre vremena "do".'); return }
    if (!consent) { setError('Potvrdite da želite obaveštenje mejlom.'); return }
    setSaving(true)
    const { error: err } = await supabase.rpc('join_waitlist', {
      p_barber_id: barber.id, p_date: date.iso, p_time_from: from || null, p_time_to: to || null,
      p_name: name, p_phone: phone, p_email: email,
    })
    setSaving(false)
    if (err) { setError('Prijava nije uspela. Proverite podatke i pokušajte ponovo.'); return }
    setDone(true)
  }

  const vreme = !from && !to ? 'u bilo koje vreme' : from && to ? `između ${from} i ${to}` : from ? `od ${from}` : `do ${to}`

  return (
    <div className="modal-overlay bg-black/80 z-50 animate-fade-in" onClick={onClose}>
      <div className="modal-panel bg-zinc-900 p-4 md:p-8 rounded-lg max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold">Lista čekanja</h3>
            <p className="text-gray-400 text-sm">{barber.name} · {date.day}, {date.formatted}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl leading-none">×</button>
        </div>

        {done ? (
          <div className="text-center py-6">
            <p className="text-green-400 text-lg font-medium mb-2">Prijavljeni ste!</p>
            <p className="text-gray-400 text-sm">
              Javićemo Vam mejlom ako se kod berbera {barber.name} oslobodi termin {vreme}.
              Termin dobija onaj ko ga prvi zakaže.
            </p>
            <button onClick={onClose} className="mt-6 w-full bg-white text-black font-semibold py-3 rounded">U REDU</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-2.5">
            <p className="text-gray-400 text-sm mb-1">
              Nema slobodnog termina koji Vam odgovara? Javićemo Vam mejlom čim se oslobodi.
            </p>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ime i prezime *"
              className="w-full bg-black border border-zinc-700 rounded px-3 py-2.5 text-sm focus:border-white focus:outline-none" />
            <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon *"
              className="w-full bg-black border border-zinc-700 rounded px-3 py-2.5 text-sm focus:border-white focus:outline-none" />
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email adresa *"
              className="w-full bg-black border border-zinc-700 rounded px-3 py-2.5 text-sm focus:border-white focus:outline-none" />
            <div>
              <label className="text-xs text-gray-500 block mb-1">Vreme koje Vam odgovara</label>
              <div className="grid grid-cols-2 gap-2">
                <select value={from} onChange={(e) => setFrom(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded px-3 py-2.5 text-sm">
                  <option value="">od: bilo kada</option>
                  {HOURS.map(h => <option key={h} value={h}>od {h}</option>)}
                </select>
                <select value={to} onChange={(e) => setTo(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded px-3 py-2.5 text-sm">
                  <option value="">do: bilo kada</option>
                  {HOURS.map(h => <option key={h} value={h}>do {h}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-start gap-2 text-xs text-gray-400 pt-1">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
              <span>Želim da dobijem mejl ako se oslobodi termin za ovaj dan. Odjava je moguća iz svakog mejla.</span>
            </label>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="modal-actions">
              <button type="submit" disabled={saving}
                className="w-full bg-white text-black font-semibold py-3 rounded hover:bg-gray-200 transition disabled:opacity-50">
                {saving ? 'ČEKAJTE...' : 'JAVI MI KAD SE OSLOBODI'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
