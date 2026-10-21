'use client';

import { useState } from 'react';
import ClientFields from './ClientFields';

// Lista cekanja jednog berbera za jedan dan (pult): ko ceka i za koje vreme, uklanjanje,
// i upis klijenta koji se javio telefonom. Mejl stize sam kad se termin oslobodi.

export const HOURS = Array.from({ length: 15 }, (_, i) => `${String(8 + i).padStart(2, '0')}:00`);
export const windowLabel = (w) => {
  const from = w.time_from?.slice(0, 5);
  const to = w.time_to?.slice(0, 5);
  if (!from && !to) return 'bilo kada';
  if (from && to) return `${from} do ${to}`;
  return from ? `od ${from}` : `do ${to}`;
};

export default function WaitlistModal({ supabase, barber, date, entries, onClose, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [client, setClient] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [saving, setSaving] = useState(false);

  const remove = async (w) => {
    if (!confirm(`Skinuti ${w.customer_name} sa liste čekanja?`)) return;
    const { error } = await supabase.from('waitlist').update({ status: 'removed' }).eq('id', w.id);
    if (error) alert(`Uklanjanje nije uspelo: ${error.message}`);
    onChanged();
  };

  const add = async (e) => {
    e.preventDefault();
    if (from && to && from > to) { alert('Vreme "od" mora biti pre vremena "do".'); return; }
    setSaving(true);
    const { error } = await supabase.rpc('join_waitlist', {
      p_barber_id: barber.id, p_date: date,
      p_time_from: from || null, p_time_to: to || null,
      p_name: `${client.firstName} ${client.lastName}`.trim(),
      p_phone: client.phone, p_email: client.email, p_source: 'pult',
    });
    setSaving(false);
    if (error) { alert(`Upis nije uspeo: ${error.message}`); return; }
    setAdding(false);
    setClient({ firstName: '', lastName: '', phone: '', email: '' });
    setFrom(''); setTo('');
    onChanged();
  };

  const [y, m, d] = date.split('-');
  return (
    <div className="modal-overlay bg-black/90 z-50" onClick={onClose}>
      <div className="modal-panel bg-zinc-900 rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-zinc-700 flex justify-between items-start gap-3">
          <div>
            <h3 className="font-medium text-lg">Lista čekanja</h3>
            <p className="text-white/50 text-sm">{barber.name} · {d}.{m}.{y}.</p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-2">
          {entries.length === 0 && <p className="text-white/40 text-sm text-center py-4">Niko ne čeka za ovaj dan.</p>}
          {entries.map(w => (
            <div key={w.id} className="rounded-lg bg-white/5 px-3 py-2 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{w.customer_name}</p>
                <p className="text-xs text-white/50 truncate">
                  <a href={`tel:${w.customer_phone}`} className="underline">{w.customer_phone}</a> · {w.customer_email}
                </p>
                <p className="text-[11px] text-white/40">
                  Vreme: {windowLabel(w)} · {w.source === 'pult' ? 'upisao pult' : 'prijava sa sajta'}
                  {w.last_notified_at && <span className="text-green-400"> · obavešten</span>}
                </p>
              </div>
              <button onClick={() => remove(w)} className="shrink-0 text-xs px-2.5 py-1.5 rounded bg-white/10 hover:bg-white/20">Ukloni</button>
            </div>
          ))}
          <p className="text-[11px] text-white/35 pt-1">
            Kad se kod ovog berbera oslobodi ili otvori termin u traženom vremenu, svi sa liste dobijaju mejl sa dugmetom za zakazivanje.
          </p>
        </div>

        <div className="p-4 border-t border-zinc-800">
          {!adding ? (
            <button onClick={() => setAdding(true)} className="w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm">
              + Upiši klijenta na listu čekanja
            </button>
          ) : (
            <form onSubmit={add} className="space-y-3">
              <ClientFields supabase={supabase} value={client} onChange={setClient} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/50 text-xs mb-1">Vreme od</label>
                  <select value={from} onChange={(e) => setFrom(e.target.value)} className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5">
                    <option value="">bilo kada</option>
                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-white/50 text-xs mb-1">Vreme do</label>
                  <select value={to} onChange={(e) => setTo(e.target.value)} className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5">
                    <option value="">bilo kada</option>
                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-white/40">Za obaveštenje je potreban mejl klijenta.</p>
              <div className="modal-actions flex gap-2">
                <button type="button" onClick={() => setAdding(false)} className="flex-1 py-2.5 rounded-lg bg-white/10 text-sm">Odustani</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-50">
                  {saving ? 'Čuvanje...' : 'Upiši na listu'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
