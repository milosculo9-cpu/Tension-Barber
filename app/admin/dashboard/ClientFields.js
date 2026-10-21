'use client';

import { useState, useEffect, useRef } from 'react';
import { withTimeout } from '@/lib/timeout';

// Podaci klijenta u formi za zakazivanje. Telefon je prvo polje: cim se upise ceo broj,
// klijent se trazi u bazi i ime, prezime i mejl se popune sami (usluga se bira rucno).
// Polja koja je korisnik sam izmenio se ne prepisuju.
// `original` (izmena klijenta na postojecem terminu): podaci sa termina se tretiraju kao
// zamenljivi, pa drugi broj donosi drugog klijenta, a nov broj prazni polja za novog klijenta.

const MIN_DIGITS = 9;
const digitsOf = (p) => (p || '').replace(/\D/g, '');

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];
const fmtDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d}. ${MONTHS[m - 1]} ${y}.`;
};

const splitName = (full) => {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
};

export default function ClientFields({ supabase, value, onChange, inputClass, original }) {
  const [lookup, setLookup] = useState(null); // null | 'loading' | { found, ... }
  const autoFilled = useRef(original
    ? { firstName: original.firstName, lastName: original.lastName, email: original.email }
    : { firstName: '', lastName: '', email: '' });
  const valueRef = useRef(value);
  valueRef.current = value;

  const cls = inputClass || 'w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-white';
  const set = (field, v) => onChange({ ...valueRef.current, [field]: v });

  // Predlozi dok se kuca ime: svi klijenti sa tim imenom, najcesci prvi.
  // Predjite misem (ili strelicama) preko imena za ostale podatke, klik popunjava formu.
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const nameTyped = useRef(false);
  const setName = (field, v) => { nameTyped.current = true; set(field, v); };

  useEffect(() => {
    if (!nameTyped.current) return;
    const q = `${value.firstName || ''} ${value.lastName || ''}`.trim();
    if (q.length < 2) { setSuggestions([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await withTimeout(() => supabase.rpc('search_clients', { p_query: q, p_limit: 8 }));
      if (cancelled || error) return;
      setSuggestions(data || []);
      setActiveIdx(0);
      setShowSug(true);
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [value.firstName, value.lastName]);

  const pickSuggestion = (c) => {
    const { firstName, lastName } = splitName(c.customer_name);
    // Zajednicki broj (npr. berberov) se ne upisuje kao broj klijenta
    const phone = c.shared_phone ? valueRef.current.phone : (c.customer_phone || '');
    const next = { ...valueRef.current, firstName, lastName, phone, email: c.customer_email || valueRef.current.email || '' };
    autoFilled.current = { firstName: next.firstName, lastName: next.lastName, email: next.email };
    nameTyped.current = false;
    setShowSug(false);
    setSuggestions([]);
    onChange(next);
  };

  const onNameKeyDown = (e) => {
    if (!showSug || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); pickSuggestion(suggestions[activeIdx]); }
    else if (e.key === 'Escape') { setShowSug(false); }
  };
  const hideSoon = () => setTimeout(() => setShowSug(false), 150);

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
      // Isti broj kao na terminu: samo se prikaze da je klijent u bazi, podaci ostaju
      if (original && digitsOf(phone) === digitsOf(original.phone)) return;
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
          autoFocus={!original}
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
      <div className="relative">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-white/50 text-xs mb-1">Ime *</label>
            <input type="text" value={value.firstName} onChange={(e) => setName('firstName', e.target.value)}
              onKeyDown={onNameKeyDown} onBlur={hideSoon} onFocus={() => suggestions.length && setShowSug(true)}
              className={cls} placeholder="Ime" required autoComplete="off" />
          </div>
          <div>
            <label className="block text-white/50 text-xs mb-1">Prezime *</label>
            <input type="text" value={value.lastName} onChange={(e) => setName('lastName', e.target.value)}
              onKeyDown={onNameKeyDown} onBlur={hideSoon} onFocus={() => suggestions.length && setShowSug(true)}
              className={cls} placeholder="Prezime" required autoComplete="off" />
          </div>
        </div>

        {showSug && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-zinc-800 border border-white/15 rounded-lg shadow-2xl overflow-hidden">
            <p className="px-3 pt-2 pb-1 text-[10px] tracking-wider text-white/40">KLIJENTI U BAZI · klik popunjava formu</p>
            <div className="max-h-72 overflow-y-auto">
              {suggestions.map((c, i) => {
                const active = i === activeIdx;
                return (
                  <button
                    key={c.client_key}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pickSuggestion(c); }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`w-full text-left px-3 py-2 border-t border-white/5 ${active ? 'bg-white/10' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-white truncate">
                        {c.customer_name}
                        {c.blacklisted && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-red-500/25 text-red-300">CRNA LISTA</span>}
                      </span>
                      <span className="shrink-0 text-[11px] text-green-400">{c.visits} {c.visits === 1 ? 'dolazak' : 'dolazaka'}</span>
                    </div>
                    {/* Ostali podaci se vide za ime preko kog je mis (ili izabrano strelicama) */}
                    {active ? (
                      <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-white/60">
                        <span>Tel: {c.shared_phone ? <span className="text-yellow-300/80">broj berbera, upišite broj klijenta</span> : (c.customer_phone || '-')}</span>
                        <span className="truncate">Email: {c.customer_email || '-'}</span>
                        <span>Poslednji put: {c.last_visit ? fmtDate(c.last_visit) : '-'}</span>
                        <span className={c.no_shows ? 'text-red-400' : ''}>Nije došao: {c.no_shows}x</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-white/35 truncate">{c.shared_phone ? '' : c.customer_phone}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div>
        <label className="block text-white/50 text-xs mb-1">Email (opciono, šalje se potvrda)</label>
        <input type="email" value={value.email} onChange={(e) => set('email', e.target.value)}
          className={cls} placeholder="klijent@email.com" />
      </div>
    </div>
  );
}
