'use client';

import { useState, useEffect, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [preloading, setPreloading] = useState(true);
  const [showSwipe, setShowSwipe] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  const touchStartY = useRef(0);
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setShowSwipe(true);
    }, 1500);
    
    return () => clearTimeout(timer1);
  }, []);

  useEffect(() => {
    if (!showSwipe || !preloading) return;

    const handleTouchStart = (e) => {
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e) => {
      const touchEndY = e.changedTouches[0].clientY;
      const diff = touchStartY.current - touchEndY;
      
      if (diff > 50) {
        handleSwipeUp();
      }
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [showSwipe, preloading]);

  const handleSwipeUp = () => {
    setPreloading(false);
    setTimeout(() => setShowForm(true), 300);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError('Pogresan email ili lozinka');
        setLoading(false);
        return;
      }

      const { data: barber, error: barberError } = await supabase
        .from('barbers')
        .select('id, name, is_admin, location_id')
        .eq('auth_user_id', data.user.id)
        .single();

      if (barberError || !barber) {
        await supabase.auth.signOut();
        setError('Nemate pristup admin panelu');
        setLoading(false);
        return;
      }

      router.push('/admin/dashboard');
    } catch (err) {
      setError('Doslo je do greske. Pokusajte ponovo.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 overflow-hidden">
      
      {preloading && (
        <div 
          className={`fixed inset-0 bg-black z-50 flex flex-col items-center justify-center transition-transform duration-500 ${!preloading ? '-translate-y-full' : 'translate-y-0'}`}
        >
          <img
            src="https://ygczcwuwmxhnbbfipfby.supabase.co/storage/v1/object/public/logo/logo.white.PNG"
            alt="Tension Barber"
            className="h-48 mb-8"
          />
          
          {showSwipe && (
            <div className="animate-bounce flex flex-col items-center text-white/50 mt-8">
              <svg className="w-8 h-8 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span className="text-sm mt-2">Prevuci na gore</span>
            </div>
          )}
        </div>
      )}

      <div className={`w-full max-w-md transition-all duration-500 ${showForm ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        
        <h1 className="text-center text-white text-2xl tracking-[0.2em] font-light mb-2">
          TENSION BARBER
        </h1>
        <p className="text-center text-white/50 text-sm tracking-[0.3em] mb-12">ADMIN PANEL</p>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-white/40 text-xs mb-2 tracking-wider">EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent border-b border-white/20 px-0 py-3 text-white focus:border-white focus:outline-none transition-colors"
              placeholder="vas@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-white/40 text-xs mb-2 tracking-wider">LOZINKA</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent border-b border-white/20 px-0 py-3 text-white focus:border-white focus:outline-none transition-colors"
              placeholder="********"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-medium py-4 rounded mt-8 hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'PRIJAVLJIVANJE...' : 'PRIJAVI SE'}
          </button>
        </form>
      </div>
    </div>
  );
}  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState({ total: 0, today: 0, revenue: 0 });
  const [activeTab, setActiveTab] = useState('termini');
  const [saving, setSaving] = useState(false);
  const [adminSection, setAdminSection] = useState(null);
  const [services, setServices] = useState([]);
  const [allBarbers, setAllBarbers] = useState([]);
  
  const router = useRouter();
  const supabase = createClientComponentClient();
  const days = getNext14Days();

  useEffect(() => {
    loadBarberData();
  }, []);

  useEffect(() => {
    if (barber) {
      loadSlotsForDate();
      loadAppointments();
    }
  }, [selectedDate, barber]);

  const loadBarberData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push('/admin');
      return;
    }

    const { data: barberData, error } = await supabase
      .from('barbers')
      .select('*, locations(id, name)')
      .eq('auth_user_id', user.id)
      .single();

    if (error || !barberData) {
      router.push('/admin');
      return;
    }

    setBarber(barberData);
    await loadStats(barberData.id);
    
    if (barberData.is_admin) {
      loadServices();
      loadAllBarbers();
    }
    
    setLoading(false);
  };

  const loadServices = async () => {
    const { data } = await supabase.from('services').select('*').order('price');
    if (data) setServices(data);
  };

  const loadAllBarbers = async () => {
    const { data } = await supabase.from('barbers').select('*, locations(name)').order('name');
    if (data) setAllBarbers(data);
  };

  const loadSlotsForDate = async () => {
    const dateStr = formatDate(selectedDate);
    
    const { data } = await supabase
      .from('barber_available_slots')
      .select('*')
      .eq('barber_id', barber.id)
      .eq('slot_date', dateStr);

    if (data) {
      setAvailableSlots(data.map(s => s.slot_time.slice(0, 5)));
    }
  };

  const loadAppointments = async () => {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('barber_id', barber.id)
      .gte('appointment_date', formatDate(new Date()))
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true });

    if (data) {
      setAppointments(data);
    }
  };

  const loadStats = async (barberId) => {
    const today = formatDate(new Date());
    
    const { count: total } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('barber_id', barberId)
      .eq('status', 'confirmed');

    const { count: todayCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('barber_id', barberId)
      .eq('appointment_date', today)
      .eq('status', 'confirmed');

    const { data: revenueData } = await supabase
      .from('appointments')
      .select('service_price')
      .eq('barber_id', barberId)
      .eq('status', 'confirmed');

    const revenue = revenueData?.reduce((sum, a) => sum + (a.service_price || 0), 0) || 0;

    setStats({ total: total || 0, today: todayCount || 0, revenue });
  };

  const toggleSlot = async (time) => {
    setSaving(true);
    const dateStr = formatDate(selectedDate);
    
    if (availableSlots.includes(time)) {
      await supabase
        .from('barber_available_slots')
        .delete()
        .eq('barber_id', barber.id)
        .eq('slot_date', dateStr)
        .eq('slot_time', time + ':00');
      
      setAvailableSlots(prev => prev.filter(s => s !== time));
    } else {
      await supabase
        .from('barber_available_slots')
        .insert({
          barber_id: barber.id,
          slot_date: dateStr,
          slot_time: time + ':00',
          is_booked: false
        });
      
      setAvailableSlots(prev => [...prev, time]);
    }
    setSaving(false);
  };

  const selectAllSlots = async () => {
    setSaving(true);
    const dateStr = formatDate(selectedDate);
    const allSlots = generateTimeSlots(barber.locations?.name);
    
    await supabase
      .from('barber_available_slots')
      .delete()
      .eq('barber_id', barber.id)
      .eq('slot_date', dateStr);

    const slotsToInsert = allSlots.map(time => ({
      barber_id: barber.id,
      slot_date: dateStr,
      slot_time: time + ':00',
      is_booked: false
    }));

    await supabase.from('barber_available_slots').insert(slotsToInsert);
    setAvailableSlots(allSlots);
    setSaving(false);
  };

  const clearAllSlots = async () => {
    setSaving(true);
    const dateStr = formatDate(selectedDate);
    
    await supabase
      .from('barber_available_slots')
      .delete()
      .eq('barber_id', barber.id)
      .eq('slot_date', dateStr);

    setAvailableSlots([]);
    setSaving(false);
  };

  const cancelAppointment = async (appointmentId) => {
    if (!confirm('Otkazati ovu rezervaciju?')) return;
    
    await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointmentId);

    loadAppointments();
    loadStats(barber.id);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Ucitavanje...</div>
      </div>
    );
  }

  const timeSlots = generateTimeSlots(barber.locations?.name);
  const tabs = [
    { id: 'termini', label: 'Termini' },
    { id: 'rezervacije', label: 'Rezervacije' },
    { id: 'statistika', label: 'Statistika' },
    ...(barber.is_admin ? [{ id: 'podesavanja', label: 'Podesavanja' }] : [])
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 bg-black z-40 border-b border-white/10">
        <div className="text-center py-4 border-b border-white/10">
          <h1 className="text-lg tracking-[0.2em] font-light">
            TENSION BARBER{barber.is_admin ? ' ADMIN' : ''}
          </h1>
        </div>
        
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-white font-medium">{barber.name}</span>
          <button onClick={handleLogout} className="text-white/50 text-sm">
            ODJAVA
          </button>
        </div>

        <nav className="overflow-x-auto scrollbar-hide">
          <div className="flex min-w-max border-t border-white/10">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setAdminSection(null); }}
                className={`px-6 py-3 text-sm tracking-wide whitespace-nowrap transition-colors
                  ${activeTab === tab.id ? 'text-white border-b-2 border-white' : 'text-white/40'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="p-4 pb-20">
        
        {activeTab === 'termini' && (
          <div className="space-y-6">
            <section>
              <h2 className="text-white/40 text-xs tracking-wider mb-3">IZABERI DATUM</h2>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {days.map((day, i) => {
                  const isSelected = formatDate(day) === formatDate(selectedDate);
                  const isToday = formatDate(day) === formatDate(new Date());
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(day)}
                      className={`flex-shrink-0 w-14 py-2 rounded-lg text-center transition-all
                        ${isSelected ? 'bg-white text-black' : 'bg-white/5 text-white'}
                        ${isToday && !isSelected ? 'ring-1 ring-white/30' : ''}`}
                    >
                      <div className="text-[10px] opacity-60">{dayNames[day.getDay()]}</div>
                      <div className="text-lg font-medium">{day.getDate()}</div>
                      <div className="text-[10px] opacity-60">{monthNames[day.getMonth()]}</div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white/40 text-xs tracking-wider">OZNACI SLOBODNE TERMINE</h2>
                <div className="flex gap-2">
                  <button onClick={selectAllSlots} disabled={saving}
                    className="text-[10px] text-white/40 px-2 py-1 border border-white/20 rounded">
                    SVE
                  </button>
                  <button onClick={clearAllSlots} disabled={saving}
                    className="text-[10px] text-white/40 px-2 py-1 border border-white/20 rounded">
                    BRISI
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-2">
                {timeSlots.map(time => {
                  const isAvailable = availableSlots.includes(time);
                  return (
                    <button
                      key={time}
                      onClick={() => toggleSlot(time)}
                      disabled={saving}
                      className={`py-3 rounded text-sm font-medium transition-all
                        ${isAvailable ? 'bg-white text-black' : 'bg-white/5 text-white/40'}
                        ${saving ? 'opacity-50' : ''}`}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'rezervacije' && (
          <div>
            <h2 className="text-white/40 text-xs tracking-wider mb-4">PREDSTOJEĆE REZERVACIJE</h2>
            
            {appointments.filter(a => a.status !== 'cancelled').length === 0 ? (
              <div className="text-center text-white/30 py-12">Nema rezervacija</div>
            ) : (
              <div className="space-y-3">
                {appointments.filter(a => a.status !== 'cancelled').map(apt => (
                  <div key={apt.id} className="bg-white/5 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{apt.customer_name}</p>
                        <p className="text-white/50 text-sm">{apt.service_name}</p>
                        <p className="text-white/30 text-sm mt-1">
                          {new Date(apt.appointment_date).toLocaleDateString('sr-RS')} • {apt.appointment_time?.slice(0, 5)}
                        </p>
                        {apt.customer_phone && (
                          <p className="text-white/30 text-sm">{apt.customer_phone}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{apt.service_price?.toLocaleString()} RSD</p>
                        <button onClick={() => cancelAppointment(apt.id)} className="text-red-400 text-xs mt-2">
                          OTKAZI
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'statistika' && (
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-white/5 rounded-lg p-6 text-center">
              <p className="text-white/40 text-xs tracking-wider">DANAS</p>
              <p className="text-4xl font-light mt-2">{stats.today}</p>
              <p className="text-white/30 text-sm">rezervacija</p>
            </div>
            <div className="bg-white/5 rounded-lg p-6 text-center">
              <p className="text-white/40 text-xs tracking-wider">UKUPNO</p>
              <p className="text-4xl font-light mt-2">{stats.total}</p>
              <p className="text-white/30 text-sm">rezervacija</p>
            </div>
            <div className="bg-white/5 rounded-lg p-6 text-center">
              <p className="text-white/40 text-xs tracking-wider">ZARADA</p>
              <p className="text-4xl font-light mt-2">{stats.revenue.toLocaleString()}</p>
              <p className="text-white/30 text-sm">RSD</p>
            </div>
          </div>
        )}

        {activeTab === 'podesavanja' && barber.is_admin && (
          <div>
            {!adminSection ? (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setAdminSection('cenovnik')} className="bg-white/5 p-6 rounded-lg text-center">
                  <span className="text-2xl">💰</span>
                  <p className="text-sm mt-2">Cenovnik</p>
                </button>
                <button onClick={() => setAdminSection('berberi')} className="bg-white/5 p-6 rounded-lg text-center">
                  <span className="text-2xl">👤</span>
                  <p className="text-sm mt-2">Berberi</p>
                </button>
                <button onClick={() => setAdminSection('slike')} className="bg-white/5 p-6 rounded-lg text-center">
                  <span className="text-2xl">🖼</span>
                  <p className="text-sm mt-2">Slike</p>
                </button>
                <button onClick={() => setAdminSection('vreme')} className="bg-white/5 p-6 rounded-lg text-center">
                  <span className="text-2xl">🕐</span>
                  <p className="text-sm mt-2">Radno vreme</p>
                </button>
              </div>
            ) : (
              <div>
                <button onClick={() => setAdminSection(null)} className="text-white/50 text-sm mb-4 flex items-center gap-2">
                  ← Nazad
                </button>
                
                {adminSection === 'cenovnik' && (
                  <div>
                    <h2 className="text-white/40 text-xs tracking-wider mb-4">CENOVNIK</h2>
                    <div className="space-y-2">
                      {services.map(service => (
                        <div key={service.id} className="bg-white/5 rounded-lg p-4 flex justify-between items-center">
                          <span className="text-sm">{service.name}</span>
                          <span className="text-white/50">{service.price?.toLocaleString()} RSD</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-white/30 text-xs mt-4 text-center">Izmena cena dolazi uskoro</p>
                  </div>
                )}

                {adminSection === 'berberi' && (
                  <div>
                    <h2 className="text-white/40 text-xs tracking-wider mb-4">BERBERI</h2>
                    <div className="space-y-2">
                      {allBarbers.map(b => (
                        <div key={b.id} className="bg-white/5 rounded-lg p-4 flex justify-between items-center">
                          <div>
                            <span className="font-medium">{b.name}</span>
                            {b.is_admin && <span className="text-xs text-white/30 ml-2">ADMIN</span>}
                          </div>
                          <span className="text-white/30 text-sm">{b.locations?.name?.split(' ').pop()}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-white/30 text-xs mt-4 text-center">Dodavanje berbera dolazi uskoro</p>
                  </div>
                )}

                {adminSection === 'slike' && (
                  <div>
                    <h2 className="text-white/40 text-xs tracking-wider mb-4">SLIKE</h2>
                    <p className="text-white/30 text-center py-8">Upload slika dolazi uskoro</p>
                  </div>
                )}

                {adminSection === 'vreme' && (
                  <div>
                    <h2 className="text-white/40 text-xs tracking-wider mb-4">RADNO VREME</h2>
                    <div className="space-y-3">
                      <div className="bg-white/5 rounded-lg p-4">
                        <p className="text-sm font-medium">Tension Barber I</p>
                        <p className="text-white/30 text-sm">Bulevar kralja Petra</p>
                        <p className="text-white/50 mt-2">10:00 - 18:00</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4">
                        <p className="text-sm font-medium">Tension Barber II</p>
                        <p className="text-white/30 text-sm">Bulevar patrijarha Pavla</p>
                        <p className="text-white/50 mt-2">10:00 - 22:00</p>
                      </div>
                    </div>
                    <p className="text-white/30 text-xs mt-4 text-center">Izmena radnog vremena dolazi uskoro</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
