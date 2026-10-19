'use client';

import { useState, useEffect, useRef } from 'react';
import { withTimeout } from '@/lib/timeout';

// Podaci klijenta u formi za zakazivanje. Telefon je prvo polje: cim se upise ceo broj,
// klijent se trazi u bazi i ime, prezime i mejl se popune sami (usluga se bira rucno).
// Polja koja je korisnik sam izmenio se ne prepisuju.

const MIN_DIGITS = 9;
const digitsOf = (p) => (p || '').replace(/\D/g, '');

const splitName = (full) => {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
};

export default function ClientFields({ supabase, value, onChange, inputClass }) {
  const [lookup, setLookup] = useState(null); // null | 'loading' | { found, ... }
  const autoFilled = useRef({ firstName: '', lastName: '', email: '' });
  const valueRef = useRef(value);
  valueRef.current = value;

  const cls = inputClass || 'w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-white';
  const set = (field, v) => onChange({ ...valueRef.current, [field]: v });

  useEffect(() => {
    const phone = value.phone;
    if (digitsOf(phone).length < MIN_DIGITS) {
      setLookup(null);
      return;
    }
    let cancelled = false;
    setLookup('loading');
    const timer = setTimeout(async () => {
      const { data, error } = await withTimeout(() => supabase.rpc('find_client_by_phone', { p_phone: phone }));
      if (cancelled) return;
      const row = !error && data && data[0];
      // Drugi broj: podaci prethodno pronadjenog klijenta se brisu (rucno upisani ostaju)
      const clearAutoFilled = () => {
        const cur = valueRef.current;
        const next = { ...cur };
        let changed = false;
        for (const f of ['firstName', 'lastName', 'email']) {
          if (cur[f] && cur[f] === autoFilled.current[f]) { next[f] = ''; changed = true; }
        }
        autoFilled.current = { firstName: '', lastName: '', email: '' };
        if (changed) onChange(next);
      };
      if (!row) { setLookup({ found: false }); clearAutoFilled(); return; }
      setLookup({ found: true, ...row });
      if (row.shared_phone || !row.customer_name) { clearAutoFilled(); return; }

      // Popunjava se samo prazno polje ili ono koje je ranije popunjeno automatski
      const cur = valueRef.current;
      const { firstName, lastName } = splitName(row.customer_name);
      const next = { ...cur };
      const canFill = (field) => !cur[field] || cur[field] === autoFilled.current[field];
      if (canFill('firstName')) next.firstName = firstName;
      if (canFill('lastName')) next.lastName = lastName;
      if (canFill('email') && row.customer_email) next.email = row.customer_email;
      autoFilled.current = { firstName: next.firstName, lastName: next.lastName, email: next.email };
      onChange(next);
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [value.phone]);

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-white/50 text-xs mb-1">Telefon *</label>
        <input
          type="tel"
          inputMode="tel"
          value={value.phone}
          onChange={(e) => set('phone', e.target.value)}
          className={cls}
          placeholder="06x xxx xxxx"
          required
          autoFocus
        />
        <p className="text-[11px] mt-1 min-h-[1rem]">
          {lookup === 'loading' && <span className="text-white/40">Tražim klijenta...</span>}
          {lookup?.found === false && <span className="text-white/40">Novi klijent, upišite ime i prezime</span>}
          {lookup?.found && lookup.shared_phone && (
            <span className="text-yellow-300/80">Ovaj broj koristi više osoba, upišite ime ručno</span>
          )}
          {lookup?.found && !lookup.shared_phone && (
            <span className="text-green-400">
              Klijent pronađen: {lookup.visits} {lookup.visits === 1 ? 'dolazak' : 'dolazaka'}
              {lookup.no_shows > 0 && <span className="text-red-400"> · nije došao {lookup.no_shows}x</span>}
            </span>
          )}
          {lookup?.found && lookup.blacklisted && <span className="text-red-400"> · NA CRNOJ LISTI</span>}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-white/50 text-xs mb-1">Ime *</label>
          <input type="text" value={value.firstName} onChange={(e) => set('firstName', e.target.value)}
            className={cls} placeholder="Ime" required />
        </div>
        <div>
          <label className="block text-white/50 text-xs mb-1">Prezime *</label>
          <input type="text" value={value.lastName} onChange={(e) => set('lastName', e.target.value)}
            className={cls} placeholder="Prezime" required />
        </div>
      </div>
      <div>
        <label className="block text-white/50 text-xs mb-1">Email (opciono, šalje se potvrda)</label>
        <input type="email" value={value.email} onChange={(e) => set('email', e.target.value)}
          className={cls} placeholder="klijent@email.com" />
      </div>
    </div>
  );
}
