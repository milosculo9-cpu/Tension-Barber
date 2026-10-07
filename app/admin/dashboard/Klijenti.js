'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { withTimeout } from '@/lib/timeout';

// Baza klijenata: koliko puta je ko dosao, otkazao i nije dosao, rangirano po dolascima.
// Racuna se u bazi (get_clients): admin dobija ceo salon, berber samo svoje termine.
// Isti klijent = isti broj telefona; broj koji nosi 5+ razlicitih imena je "zajednicki"
// (berber upisao svoj broj), pa se tu klijenti razlikuju po imenu.

const PAGE = 50;

// Poslednja ucitana lista ostaje u memoriji dok je panel otvoren: povratak na tab je trenutan,
// a osvezavanje ide u pozadini.
const cache = { barberId: null, clients: null };
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];

// Pretraga ne zavisi od kvacica: "djordjevic" nalazi "Đorđević"
const fold = (t) => (t || '')
  .toLowerCase()
  .replace(/đ/g, 'dj')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '');

const digits = (t) => {
  let d = (t || '').replace(/\D/g, '');
  if (d.startsWith('00381')) d = '0' + d.slice(5);
  else if (d.startsWith('381') && d.length >= 11) d = '0' + d.slice(3);
  return d;
};

const fmtDate = (str) => {
  if (!str) return '';
  const [y, m, d] = str.split('-').map(Number);
  return `${d}. ${MONTHS[m - 1]} ${y}.`;
};

const aptStatus = (a) => {
  if (a.status === 'cancelled') return { label: 'Otkazan', cls: 'text-white/40' };
  if (a.no_show) return { label: 'Nije došao', cls: 'text-red-400' };
  const [y, m, d] = a.appointment_date.split('-').map(Number);
  const [h, mi] = (a.appointment_time || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, h, mi) <= new Date()
    ? { label: 'Došao', cls: 'text-green-400' }
    : { label: 'Predstoji', cls: 'text-yellow-300' };
};

export default function Klijenti({ supabase, barber }) {
  const isAdmin = !!barber?.is_admin;
  const cached = cache.barberId === barber?.id ? cache.clients : null;
  const [clients, setClients] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const loadingRef = useRef(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = async () => {
    if (loadingRef.current) return; // isti zahtev se ne salje dvaput
    loadingRef.current = true;
    if (!cache.clients || cache.barberId !== barber.id) setLoading(true);
    setError('');
    const { data, error: err } = await withTimeout(() => supabase.rpc('get_clients'));
    loadingRef.current = false;
    if (err) {
      console.error('Klijenti:', err.message);
      setError(err.message === 'timeout'
        ? 'Baza ne odgovara. Proverite internet i pokušajte ponovo.'
        : 'Učitavanje klijenata nije uspelo.');
      setLoading(false);
      return;
    }
    // Rang se racuna jednom, pre pretrage, da klijent zadrzi svoje mesto i kad se filtrira
    const ranked = (data || []).map((c, i) => ({ ...c, rank: c.placeholder ? null : i + 1 }));
    cache.barberId = barber.id;
    cache.clients = ranked;
    setClients(ranked);
    setLoading(false);
  };

  useEffect(() => {
    if (barber?.id) load();
  }, [barber?.id]);

  useEffect(() => { setShown(PAGE); }, [query]);

  // Jedno polje: trazi po imenu, prezimenu ILI broju telefona
  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return clients;
    const qDigits = digits(q);
    const looksLikePhone = qDigits.length >= 3 && qDigits.length >= q.replace(/\s/g, '').length - 1;
    if (looksLikePhone) {
      const qNoZero = qDigits.replace(/^0/, '');
      return clients.filter(c => digits(c.customer_phone).includes(qNoZero));
    }
    const words = fold(q).split(/\s+/).filter(Boolean);
    return clients.filter(c => {
      const name = fold(c.customer_name);
      return words.every(w => name.includes(w));
    });
  }, [clients, query]);

  const totals = useMemo(() => ({
    clients: clients.filter(c => !c.placeholder).length,
    visits: clients.reduce((s, c) => s + c.visits, 0),
  }), [clients]);

  const openClient = async (c) => {
    setSelected(c);
    setHistory([]);
    setHistoryLoading(true);
    const { data, error: err } = await withTimeout(() => supabase.rpc('get_client_appointments', { p_client_key: c.client_key }));
    if (err) console.error('Istorija klijenta:', err.message);
    setHistory(data || []);
    setHistoryLoading(false);
  };

  return (
    <div className="space-y-4">
      <section>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pretraga: ime, prezime ili broj telefona"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30"
        />
        <p className="text-white/30 text-xs mt-2">
          {loading ? 'Učitavanje...' : query.trim()
            ? `Pronađeno: ${filtered.length}`
            : `${totals.clients} klijenata · ${totals.visits} dolazaka${isAdmin ? ' u celom salonu' : ' kod Vas'} · rangirano po broju dolazaka`}
        </p>
      </section>

      {error && (
        <div className="flex items-center justify-between gap-3 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <p className="text-red-300 text-sm">{error}</p>
          <button onClick={load} className="shrink-0 px-3 py-1.5 rounded bg-white text-black text-sm">Pokušaj ponovo</button>
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <p className="text-white/30 text-sm text-center py-8">Nema klijenata za ovu pretragu</p>
      )}

      <div className="space-y-1">
        {filtered.slice(0, shown).map(c => (
          <button
            key={c.client_key}
            onClick={() => openClient(c)}
            className="w-full text-left rounded-lg px-3 py-3 bg-white/5 hover:bg-white/10 flex items-center gap-3"
          >
            <span className="w-9 shrink-0 text-right text-white/30 text-sm">{c.rank ? `${c.rank}.` : ''}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">
                {c.customer_name || 'Bez imena'}
                {c.blacklisted && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">CRNA LISTA</span>}
              </p>
              <p className="text-xs text-white/40 truncate">
                {c.customer_phone}
                {c.last_visit && ` · poslednji put ${fmtDate(c.last_visit)}`}
                {c.upcoming > 0 && <span className="text-yellow-300"> · zakazan</span>}
              </p>
            </div>
            <div className="shrink-0 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-green-400 text-sm font-medium">{c.visits}</p>
                <p className="text-white/30 text-[9px] tracking-wider">DOŠAO</p>
              </div>
              <div>
                <p className="text-white/70 text-sm font-medium">{c.cancellations}</p>
                <p className="text-white/30 text-[9px] tracking-wider">OTKAZAO</p>
              </div>
              <div>
                <p className={`text-sm font-medium ${c.no_shows ? 'text-red-400' : 'text-white/70'}`}>{c.no_shows}</p>
                <p className="text-white/30 text-[9px] tracking-wider">NIJE DOŠAO</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {filtered.length > shown && (
        <button
          onClick={() => setShown(n => n + PAGE)}
          className="w-full py-3 rounded-lg bg-white/10 text-sm text-white/70"
        >
          Prikaži još ({filtered.length - shown})
        </button>
      )}

      {/* Kartica klijenta */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-zinc-900 rounded-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-700 flex justify-between items-start gap-3">
              <div className="min-w-0">
                <h3 className="font-medium text-lg truncate">{selected.customer_name || 'Bez imena'}</h3>
                <p className="text-white/50 text-sm">
                  {selected.customer_phone && <a href={`tel:${selected.customer_phone}`} className="underline">{selected.customer_phone}</a>}
                  {selected.customer_email && <> · {selected.customer_email}</>}
                </p>
                {selected.blacklisted && <p className="text-red-400 text-xs mt-1">Klijent je na crnoj listi</p>}
                {selected.shared_phone && (
                  <p className="text-yellow-300/80 text-xs mt-1">
                    Ovaj broj je upisan uz više različitih imena (verovatno broj berbera), pa se klijent prepoznaje po imenu.
                  </p>
                )}
              </div>
              <button onClick={() => setSelected(null)} className="text-white/50 hover:text-white text-2xl leading-none">×</button>
            </div>

            <div className="grid grid-cols-4 gap-2 p-4 border-b border-zinc-800 text-center">
              <div><p className="text-green-400 text-xl">{selected.visits}</p><p className="text-white/40 text-[10px]">DOŠAO</p></div>
              <div><p className="text-xl">{selected.cancellations}</p><p className="text-white/40 text-[10px]">OTKAZAO</p></div>
              <div><p className="text-red-400 text-xl">{selected.no_shows}</p><p className="text-white/40 text-[10px]">NIJE DOŠAO</p></div>
              <div><p className="text-xl">{Number(selected.spent || 0).toLocaleString('sr-RS')}</p><p className="text-white/40 text-[10px]">RSD UKUPNO</p></div>
            </div>
            {selected.first_visit && (
              <p className="px-4 pt-3 text-white/40 text-xs">
                Prvi dolazak {fmtDate(selected.first_visit)} · poslednji {fmtDate(selected.last_visit)}
              </p>
            )}

            <div className="overflow-y-auto p-4 space-y-1">
              {historyLoading ? (
                <p className="text-white/30 text-sm text-center py-6">Učitavanje istorije...</p>
              ) : history.map(a => {
                const st = aptStatus(a);
                return (
                  <div key={a.id} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
                    <div className="w-24 shrink-0 text-xs text-white/60">
                      {fmtDate(a.appointment_date)}<br />{a.appointment_time?.slice(0, 5)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{a.service_name}</p>
                      <p className="text-xs text-white/40 truncate">{isAdmin ? `${a.barber_name || 'Bivši berber'} · ` : ''}{a.customer_name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm">{(a.service_price || 0).toLocaleString('sr-RS')}</p>
                      <p className={`text-[11px] ${st.cls}`}>{st.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
