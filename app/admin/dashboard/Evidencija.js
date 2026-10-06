'use client';

import { useState, useEffect, useMemo } from 'react';

// Evidencija klijenata: ko je dosao, ko nije, po danu, nedelji i mesecu.
// Berber vidi samo svoje klijente, admin vidi sve berbere.

const PERIODS = [
  { id: 'dan', label: 'Dan' },
  { id: 'nedelja', label: 'Nedelja' },
  { id: 'mesec', label: 'Mesec' },
];

const MONTHS = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];
const DAYS = ['nedelja', 'ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota'];

const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseDate = (str) => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Pocetak i kraj perioda u kome je dati dan (nedelja ide od ponedeljka)
const getRange = (period, anchor) => {
  const a = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  if (period === 'dan') return { from: a, to: a };
  if (period === 'nedelja') {
    const shift = (a.getDay() + 6) % 7;
    const from = new Date(a.getFullYear(), a.getMonth(), a.getDate() - shift);
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6);
    return { from, to };
  }
  return {
    from: new Date(a.getFullYear(), a.getMonth(), 1),
    to: new Date(a.getFullYear(), a.getMonth() + 1, 0),
  };
};

const shiftAnchor = (period, anchor, dir) => {
  if (period === 'dan') return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + dir);
  if (period === 'nedelja') return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 7 * dir);
  return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
};

const rangeLabel = (period, { from, to }) => {
  if (period === 'dan') return `${DAYS[from.getDay()]}, ${from.getDate()}. ${MONTHS[from.getMonth()]} ${from.getFullYear()}.`;
  if (period === 'nedelja') {
    const sameMonth = from.getMonth() === to.getMonth();
    return `${from.getDate()}.${sameMonth ? '' : ` ${MONTHS[from.getMonth()]}`} do ${to.getDate()}. ${MONTHS[to.getMonth()]} ${to.getFullYear()}.`;
  }
  return `${MONTHS[from.getMonth()]} ${from.getFullYear()}.`;
};

// Termin je "dosao" kad mu prodje kraj, osim ako je oznacen kao "nije dosao"
const getStatus = (apt) => {
  if (apt.no_show) return 'nije';
  const start = parseDate(apt.appointment_date);
  const [h, m] = (apt.appointment_time || '00:00').split(':').map(Number);
  start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + (apt.duration_minutes || 30) * 60 * 1000);
  if (new Date() >= end) return 'dosao';
  return new Date() >= start ? 'u-toku' : 'predstoji';
};

const STATUS_STYLE = {
  dosao: { label: 'Došao', cls: 'text-green-400' },
  nije: { label: 'Nije došao', cls: 'text-red-400' },
  'u-toku': { label: 'U toku', cls: 'text-yellow-300' },
  predstoji: { label: 'Predstoji', cls: 'text-white/40' },
};

const summarize = (list) => {
  const s = { dosao: 0, nije: 0, predstoji: 0, zarada: 0 };
  list.forEach(a => {
    const st = getStatus(a);
    if (st === 'dosao') { s.dosao += 1; s.zarada += a.service_price || 0; }
    else if (st === 'nije') s.nije += 1;
    else s.predstoji += 1;
  });
  return s;
};

export default function Evidencija({ supabase, barber, locations = [] }) {
  const isAdmin = !!barber?.is_admin;
  const [period, setPeriod] = useState('dan');
  const [anchor, setAnchor] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [barberFilter, setBarberFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  // Admin ucitava i neaktivne berbere, da im se vide imena u starijim periodima
  const [allBarbers, setAllBarbers] = useState([]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from('barbers')
      .select('id, name, location_id, display_order, is_active')
      .then(({ data }) => setAllBarbers(data || []));
  }, [isAdmin]);

  const range = useMemo(() => getRange(period, anchor), [period, anchor]);

  const load = async () => {
    setLoading(true);
    const from = formatDate(range.from);
    const to = formatDate(range.to);
    // Supabase vraca najvise 1000 redova po upitu, pa se mesec za ceo salon cita u delovima
    const pageSize = 1000;
    let rows = [];
    for (let page = 0; page < 20; page++) {
      let query = supabase
        .from('appointments')
        .select('id, barber_id, customer_name, customer_phone, service_name, service_price, appointment_date, appointment_time, duration_minutes, status, no_show')
        .gte('appointment_date', from)
        .lte('appointment_date', to)
        .neq('status', 'cancelled')
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (!isAdmin) query = query.eq('barber_id', barber.id);
      const { data, error } = await query;
      if (error) { console.error('Evidencija:', error.message); break; }
      rows = rows.concat(data || []);
      if (!data || data.length < pageSize) break;
    }
    setAppointments(rows);
    setLoading(false);
  };

  useEffect(() => {
    if (barber) load();
  }, [barber, range.from.getTime(), range.to.getTime()]);

  const barbersById = useMemo(() => {
    const map = {};
    allBarbers.forEach(b => { map[b.id] = b; });
    return map;
  }, [allBarbers]);

  // Berberi koji se prikazuju adminu: svi sa lokalom, plus oni koji imaju termine u periodu (i neaktivni)
  const adminBarbers = useMemo(() => {
    if (!isAdmin) return [];
    const ids = new Set(allBarbers.filter(b => b.location_id && b.is_active !== false).map(b => b.id));
    appointments.forEach(a => ids.add(a.barber_id));
    return [...ids]
      .map(id => barbersById[id] || { id, name: 'Bivši berber', location_id: null })
      .filter(b => locationFilter === 'all' || b.location_id === locationFilter)
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || a.name.localeCompare(b.name));
  }, [isAdmin, allBarbers, appointments, barbersById, locationFilter]);

  const visible = useMemo(() => {
    if (!isAdmin) return appointments;
    const allowed = new Set(adminBarbers.map(b => b.id));
    return appointments.filter(a =>
      allowed.has(a.barber_id) && (barberFilter === 'all' || a.barber_id === barberFilter)
    );
  }, [isAdmin, appointments, adminBarbers, barberFilter]);

  const total = summarize(visible);

  const perBarber = useMemo(() => {
    if (!isAdmin || barberFilter !== 'all') return [];
    return adminBarbers
      .map(b => ({ barber: b, ...summarize(appointments.filter(a => a.barber_id === b.id)) }))
      .filter(r => r.dosao + r.nije + r.predstoji > 0);
  }, [isAdmin, barberFilter, adminBarbers, appointments]);

  const byDate = useMemo(() => {
    const groups = {};
    visible.forEach(a => {
      (groups[a.appointment_date] = groups[a.appointment_date] || []).push(a);
    });
    return Object.entries(groups);
  }, [visible]);

  const markNoShow = async (apt) => {
    if (!confirm(`Označiti da ${apt.customer_name} nije došao? Klijent ide na crnu listu.`)) return;
    setBusyId(apt.id);
    const { error } = await supabase.from('appointments').update({ no_show: true }).eq('id', apt.id);
    if (!error && apt.customer_phone) {
      await supabase.from('blacklist').insert({
        customer_phone: apt.customer_phone,
        customer_name: apt.customer_name,
        missed_appointment_id: apt.id,
        missed_service_name: apt.service_name,
        missed_service_price: apt.service_price,
        missed_date: apt.appointment_date,
      });
    }
    if (error) alert(`Čuvanje nije uspelo: ${error.message}`);
    setBusyId(null);
    load();
  };

  const undoNoShow = async (apt) => {
    if (!confirm(`Poništiti "nije došao" za ${apt.customer_name}? Klijent se skida sa crne liste za ovaj termin.`)) return;
    setBusyId(apt.id);
    const { error } = await supabase.from('appointments').update({ no_show: false }).eq('id', apt.id);
    if (!error) {
      await supabase.from('blacklist').delete().eq('missed_appointment_id', apt.id);
    }
    if (error) alert(`Čuvanje nije uspelo: ${error.message}`);
    setBusyId(null);
    load();
  };

  const isToday = formatDate(range.from) <= formatDate(new Date()) && formatDate(new Date()) <= formatDate(range.to);
  const showBarberName = isAdmin && barberFilter === 'all';

  return (
    <div className="space-y-6">
      {/* Period */}
      <section>
        <div className="flex gap-2 mb-3">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`flex-1 py-2 rounded text-sm ${period === p.id ? 'bg-white text-black' : 'bg-white/10 text-white/60'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => setAnchor(shiftAnchor(period, anchor, -1))} className="px-4 py-2 bg-white/10 rounded text-lg">←</button>
          <div className="text-center">
            <p className="text-sm capitalize">{rangeLabel(period, range)}</p>
            {!isToday && (
              <button onClick={() => setAnchor(new Date())} className="text-xs text-white/40 underline mt-1">nazad na danas</button>
            )}
          </div>
          <button onClick={() => setAnchor(shiftAnchor(period, anchor, 1))} className="px-4 py-2 bg-white/10 rounded text-lg">→</button>
        </div>
      </section>

      {/* Filteri za admina */}
      {isAdmin && (
        <section className="space-y-2">
          {locations.length > 1 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => { setLocationFilter('all'); setBarberFilter('all'); }}
                className={`px-3 py-1 rounded text-xs whitespace-nowrap ${locationFilter === 'all' ? 'bg-white text-black' : 'bg-white/10 text-white/60'}`}
              >
                Oba lokala
              </button>
              {locations.map(l => (
                <button
                  key={l.id}
                  onClick={() => { setLocationFilter(l.id); setBarberFilter('all'); }}
                  className={`px-3 py-1 rounded text-xs whitespace-nowrap ${locationFilter === l.id ? 'bg-white text-black' : 'bg-white/10 text-white/60'}`}
                >
                  {l.name}
                </button>
              ))}
            </div>
          )}
          <select
            value={barberFilter}
            onChange={(e) => setBarberFilter(e.target.value)}
            className="w-full bg-white/10 rounded px-3 py-2 text-sm"
          >
            <option value="all">Svi berberi</option>
            {adminBarbers.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </section>
      )}

      {/* Zbir */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <p className="text-white/40 text-[10px] tracking-wider">DOŠLO</p>
          <p className="text-2xl font-light text-green-400">{total.dosao}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <p className="text-white/40 text-[10px] tracking-wider">NIJE DOŠLO</p>
          <p className="text-2xl font-light text-red-400">{total.nije}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <p className="text-white/40 text-[10px] tracking-wider">PREDSTOJI</p>
          <p className="text-2xl font-light">{total.predstoji}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <p className="text-white/40 text-[10px] tracking-wider">ZARADA</p>
          <p className="text-2xl font-light">{total.zarada.toLocaleString('sr-RS')}</p>
          <p className="text-white/30 text-[10px]">RSD</p>
        </div>
      </section>

      {/* Po berberu (admin, svi berberi) */}
      {perBarber.length > 0 && (
        <section>
          <h2 className="text-white/40 text-xs tracking-wider mb-2">PO BERBERU</h2>
          <div className="bg-white/5 rounded-lg overflow-hidden">
            <div className="grid grid-cols-5 gap-2 px-3 py-2 text-[10px] tracking-wider text-white/40 border-b border-white/10">
              <span className="col-span-2">BERBER</span>
              <span className="text-right">DOŠLO</span>
              <span className="text-right">NIJE</span>
              <span className="text-right">RSD</span>
            </div>
            {perBarber.map(r => (
              <button
                key={r.barber.id}
                onClick={() => setBarberFilter(r.barber.id)}
                className="w-full grid grid-cols-5 gap-2 px-3 py-2 text-sm text-left border-b border-white/5 hover:bg-white/5"
              >
                <span className="col-span-2 truncate">{r.barber.name}</span>
                <span className="text-right text-green-400">{r.dosao}</span>
                <span className="text-right text-red-400">{r.nije || ''}</span>
                <span className="text-right">{r.zarada.toLocaleString('sr-RS')}</span>
              </button>
            ))}
          </div>
          <p className="text-white/30 text-[11px] mt-1">Klikni na berbera za njegov spisak klijenata.</p>
        </section>
      )}

      {/* Spisak klijenata */}
      <section>
        <h2 className="text-white/40 text-xs tracking-wider mb-2">
          SPISAK KLIJENATA{isAdmin && barberFilter !== 'all' ? ` · ${barbersById[barberFilter]?.name || ''}` : ''}
        </h2>
        {loading ? (
          <p className="text-white/30 text-sm text-center py-8">Učitavanje...</p>
        ) : byDate.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-8">Nema termina u ovom periodu</p>
        ) : (
          <div className="space-y-4">
            {byDate.map(([date, list]) => {
              const d = parseDate(date);
              const daySum = summarize(list);
              return (
                <div key={date}>
                  {period !== 'dan' && (
                    <div className="flex justify-between text-xs text-white/50 mb-1 px-1">
                      <span className="capitalize">{DAYS[d.getDay()]}, {d.getDate()}. {MONTHS[d.getMonth()]}</span>
                      <span>{daySum.dosao} došlo{daySum.nije ? `, ${daySum.nije} nije` : ''}</span>
                    </div>
                  )}
                  <div className="space-y-1">
                    {list.map(apt => {
                      const st = getStatus(apt);
                      const style = STATUS_STYLE[st];
                      const canEdit = isAdmin || apt.barber_id === barber.id;
                      return (
                        <div
                          key={apt.id}
                          className={`rounded-lg px-3 py-2 flex items-center gap-3 ${st === 'nije' ? 'bg-red-500/10' : 'bg-white/5'}`}
                        >
                          <span className="text-sm text-white/60 w-12 shrink-0">{apt.appointment_time?.slice(0, 5)}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm truncate ${st === 'nije' ? 'text-red-300' : ''}`}>{apt.customer_name}</p>
                            <p className="text-xs text-white/40 truncate">
                              {showBarberName && `${barbersById[apt.barber_id]?.name || 'Bivši berber'} · `}
                              {apt.service_name}
                              {apt.customer_phone && (
                                <> · <a href={`tel:${apt.customer_phone}`} className="underline">{apt.customer_phone}</a></>
                              )}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm ${st === 'nije' ? 'line-through text-white/30' : ''}`}>
                              {(apt.service_price || 0).toLocaleString('sr-RS')}
                            </p>
                            <p className={`text-[11px] ${style.cls}`}>{style.label}</p>
                          </div>
                          {canEdit && (st === 'dosao' || st === 'u-toku') && (
                            <button
                              onClick={() => markNoShow(apt)}
                              disabled={busyId === apt.id}
                              title="Nije došao"
                              className="shrink-0 text-[10px] px-2 py-1 rounded bg-red-500/20 text-red-300 disabled:opacity-50"
                            >
                              NIJE<br />DOŠAO
                            </button>
                          )}
                          {canEdit && st === 'nije' && (
                            <button
                              onClick={() => undoNoShow(apt)}
                              disabled={busyId === apt.id}
                              title="Poništi"
                              className="shrink-0 text-[10px] px-2 py-1 rounded bg-white/10 text-white/60 disabled:opacity-50"
                            >
                              PONIŠTI
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
