'use client';

import { useState, useEffect, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

const STORAGE_URL = 'https://ygczcwuwmxhnbbfipfby.supabase.co/storage/v1/object/public';

const generateTimeSlots = (locationName) => {
  const slots = [];
  const startHour = 10;
  const endHour = locationName?.includes('Petra') ? 18 : 22;
  
  for (let hour = startHour; hour < endHour; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
    slots.push(`${hour.toString().padStart(2, '0')}:30`);
  }
  return slots;
};

const formatDate = (date) => date.toISOString().split('T')[0];

const getNext14Days = () => {
  const days = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    days.push(date);
  }
  return days;
};

const dayNames = ['NED', 'PON', 'UTO', 'SRE', 'CET', 'PET', 'SUB'];
const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAJ', 'JUN', 'JUL', 'AVG', 'SEP', 'OKT', 'NOV', 'DEC'];

export default function Dashboard() {
  const [barber, setBarber] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState({ total: 0, today: 0, revenue: 0 });
  const [activeTab, setActiveTab] = useState('termini');
  const [saving, setSaving] = useState(false);
  const [adminSection, setAdminSection] = useState(null);
  const [services, setServices] = useState([]);
  const [allBarbers, setAllBarbers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [slotsLocked, setSlotsLocked] = useState(false);
  const [newAppointmentAlert, setNewAppointmentAlert] = useState(null);
  
  const [editingService, setEditingService] = useState(null);
  const [editingBarber, setEditingBarber] = useState(null);
  const [showAddBarber, setShowAddBarber] = useState(false);
  const [newBarberName, setNewBarberName] = useState('');
  const [newBarberLocation, setNewBarberLocation] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imgErrors, setImgErrors] = useState({});
  
  const fileInputRef = useRef(null);
  const router = useRouter();
  const supabase = createClientComponentClient();
  const days = getNext14Days();

  const tabs = [
    { id: 'termini', label: 'Termini' },
    { id: 'rezervacije', label: 'Rezervacije' },
    { id: 'statistika', label: 'Statistika' },
    { id: 'podesavanja', label: 'Podesavanja' }
  ];

  const changeTab = (tabId) => {
    setActiveTab(tabId);
    setAdminSection(null);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    loadBarberData();
  }, []);

  useEffect(() => {
    if (barber) {
      loadSlotsForDate();
      loadAppointments();
    }
  }, [selectedDate, barber]);

  // Real-time subscription for new appointments
  useEffect(() => {
    if (!barber) return;

    const channel = supabase
      .channel('appointments-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: `barber_id=eq.${barber.id}`
        },
        (payload) => {
          console.log('New appointment:', payload);
          // Show alert
          setNewAppointmentAlert(payload.new);
          // Reload appointments
          loadAppointments();
          loadStats(barber.id);
          // Hide alert after 5 seconds
          setTimeout(() => setNewAppointmentAlert(null), 5000);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `barber_id=eq.${barber.id}`
        },
        () => {
          loadAppointments();
          loadStats(barber.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barber]);

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
      loadLocations();
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

  const loadLocations = async () => {
    const { data } = await supabase.from('locations').select('*');
    if (data) setLocations(data);
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
    } else {
      setAvailableSlots([]);
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
    if (slotsLocked) return;
    
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
    if (slotsLocked) return;
    
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
    if (slotsLocked) return;
    
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

  const updateServicePrice = async () => {
    if (!editingService || !newServicePrice) return;
    
    const price = parseInt(newServicePrice);
    if (isNaN(price)) return;
    
    await supabase
      .from('services')
      .update({ price })
      .eq('id', editingService.id);
    
    setEditingService(null);
    setNewServicePrice('');
    loadServices();
  };

  const addBarber = async () => {
    if (!newBarberName || !newBarberLocation) return;
    
    await supabase
      .from('barbers')
      .insert({
        name: newBarberName,
        location_id: newBarberLocation,
        is_admin: false
      });
    
    setShowAddBarber(false);
    setNewBarberName('');
    setNewBarberLocation('');
    loadAllBarbers();
  };

  const deleteBarber = async (barberId) => {
    if (!confirm('Obrisati ovog berbera?')) return;
    
    await supabase
      .from('barbers')
      .delete()
      .eq('id', barberId);
    
    setEditingBarber(null);
    loadAllBarbers();
  };

  const updateBarberName = async (newName) => {
    if (!editingBarber || !newName) return;
    
    await supabase
      .from('barbers')
      .update({ name: newName })
      .eq('id', editingBarber.id);
    
    loadAllBarbers();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editingBarber) return;
    
    setUploadingImage(true);
    
    const fileExt = file.name.split('.').pop().toLowerCase();
    const fileName = `${editingBarber.name.toLowerCase().replace(/[^a-z]/g, '')}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('barbers')
      .upload(fileName, file, { upsert: true });
    
    if (!uploadError) {
      const imageUrl = `${STORAGE_URL}/barbers/${fileName}`;
      
      await supabase
        .from('barbers')
        .update({ image_url: imageUrl })
        .eq('id', editingBarber.id);
      
      setEditingBarber({ ...editingBarber, image_url: imageUrl });
      loadAllBarbers();
    }
    
    setUploadingImage(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Ucitavanje...</div>
      </div>
    );
  }

  const timeSlots = generateTimeSlots(barber.locations?.name);
  const availableTabs = barber?.is_admin ? tabs : tabs.filter(t => t.id !== 'podesavanja');

  return (
    <div className="min-h-screen bg-black text-white">
      
      {/* New Appointment Alert */}
      {newAppointmentAlert && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-green-600 text-white p-4 rounded-lg shadow-2xl animate-slide-down">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="font-bold">Nova rezervacija!</p>
              <p className="text-sm text-green-100">
                {newAppointmentAlert.customer_name} - {newAppointmentAlert.service_name}
              </p>
              <p className="text-xs text-green-200">
                {newAppointmentAlert.appointment_date} u {newAppointmentAlert.appointment_time?.slice(0, 5)}
              </p>
            </div>
          </div>
        </div>
      )}

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
            {availableTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => changeTab(tab.id)}
                className={`px-6 py-3 text-sm tracking-wide whitespace-nowrap transition-colors
                  ${activeTab === tab.id ? 'text-white border-b-2 border-white' : 'text-white/40'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="p-4 pb-20 min-h-[60vh]">
        
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
                      onClick={() => { setSelectedDate(day); setSlotsLocked(false); }}
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
                {!slotsLocked && (
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
                )}
              </div>
              
              <div className="grid grid-cols-4 gap-2">
                {timeSlots.map(time => {
                  const isAvailable = availableSlots.includes(time);
                  return (
                    <button
                      key={time}
                      onClick={() => toggleSlot(time)}
                      disabled={saving || slotsLocked}
                      className={`py-3 rounded text-sm font-medium transition-all
                        ${isAvailable ? 'bg-white text-black' : 'bg-white/5 text-white/40'}
                        ${saving ? 'opacity-50' : ''}
                        ${slotsLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
              
              {slotsLocked && (
                <p className="text-green-400 text-xs mt-3 text-center">Termini su zakljucani</p>
              )}
            </section>

            <button
              onClick={() => setSlotsLocked(!slotsLocked)}
              className={`w-full py-4 rounded-lg font-medium transition-all ${
                slotsLocked 
                  ? 'bg-white/10 text-white border border-white/20' 
                  : 'bg-white text-black'
              }`}
            >
              {slotsLocked ? 'IZMENI TERMINE' : 'ZAKLJUCI TERMINE'}
            </button>
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
                          {new Date(apt.appointment_date).toLocaleDateString('sr-RS')} - {apt.appointment_time?.slice(0, 5)}
                        </p>
                        {apt.customer_phone && (
                          <a href={`tel:${apt.customer_phone}`} className="text-white/40 text-sm hover:text-white">
                            📞 {apt.customer_phone}
                          </a>
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
              <div className="space-y-4">
                <button onClick={() => setAdminSection('cenovnik')} className="w-full bg-white/5 p-8 rounded-lg flex items-center gap-4">
                  <span className="text-4xl">💰</span>
                  <div className="text-left">
                    <p className="text-lg font-medium">Cenovnik</p>
                    <p className="text-white/40 text-sm">Izmeni cene usluga</p>
                  </div>
                </button>
                <button onClick={() => setAdminSection('berberi')} className="w-full bg-white/5 p-8 rounded-lg flex items-center gap-4">
                  <span className="text-4xl">👤</span>
                  <div className="text-left">
                    <p className="text-lg font-medium">Berberi</p>
                    <p className="text-white/40 text-sm">Dodaj, izmeni ili obrisi berbere</p>
                  </div>
                </button>
              </div>
            ) : (
              <div>
                <button onClick={() => { setAdminSection(null); setEditingService(null); setEditingBarber(null); setShowAddBarber(false); }} 
                  className="text-white/50 text-sm mb-4 flex items-center gap-2">
                  ← Nazad
                </button>
                
                {adminSection === 'cenovnik' && (
                  <div>
                    <h2 className="text-white/40 text-xs tracking-wider mb-4">CENOVNIK</h2>
                    <div className="space-y-2">
                      {services.map(service => (
                        <button
                          key={service.id}
                          onClick={() => { setEditingService(service); setNewServicePrice(service.price?.toString() || ''); }}
                          className="w-full bg-white/5 rounded-lg p-4 flex justify-between items-center text-left"
                        >
                          <span className="text-sm">{service.name}</span>
                          <span className="text-white/50">{service.price?.toLocaleString()} RSD</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {adminSection === 'berberi' && !editingBarber && !showAddBarber && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-white/40 text-xs tracking-wider">BERBERI</h2>
                      <button onClick={() => setShowAddBarber(true)} className="text-xs bg-white text-black px-3 py-1 rounded">
                        + DODAJ
                      </button>
                    </div>
                    <div className="space-y-2">
                      {allBarbers.map(b => (
                        <button
                          key={b.id}
                          onClick={() => setEditingBarber(b)}
                          className="w-full bg-white/5 rounded-lg p-4 flex justify-between items-center"
                        >
                          <div className="flex items-center gap-3">
                            {b.image_url && !imgErrors[b.id] ? (
                              <img 
                                src={b.image_url} 
                                alt={b.name} 
                                className="w-12 h-12 rounded-full object-cover"
                                onError={() => setImgErrors(prev => ({...prev, [b.id]: true}))}
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white/30 text-xl">
                                👤
                              </div>
                            )}
                            <div className="text-left">
                              <span className="font-medium">{b.name}</span>
                              {b.is_admin && <span className="text-xs text-white/30 ml-2">ADMIN</span>}
                              <p className="text-white/30 text-sm">{b.locations?.name}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {adminSection === 'berberi' && showAddBarber && (
                  <div>
                    <h2 className="text-white/40 text-xs tracking-wider mb-4">DODAJ BERBERA</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-white/40 text-xs mb-2">IME</label>
                        <input
                          type="text"
                          value={newBarberName}
                          onChange={(e) => setNewBarberName(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white"
                          placeholder="Ime berbera"
                        />
                      </div>
                      <div>
                        <label className="block text-white/40 text-xs mb-2">LOKACIJA</label>
                        <select
                          value={newBarberLocation}
                          onChange={(e) => setNewBarberLocation(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white"
                        >
                          <option value="">Izaberi lokaciju</option>
                          {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={addBarber}
                        disabled={!newBarberName || !newBarberLocation}
                        className="w-full bg-white text-black py-3 rounded-lg font-medium disabled:opacity-50"
                      >
                        SACUVAJ
                      </button>
                    </div>
                  </div>
                )}

                {adminSection === 'berberi' && editingBarber && (
                  <div>
                    <h2 className="text-white/40 text-xs tracking-wider mb-4">IZMENI BERBERA</h2>
                    
                    <div className="flex flex-col items-center mb-6">
                      {editingBarber.image_url ? (
                        <img 
                          src={editingBarber.image_url} 
                          alt={editingBarber.name} 
                          className="w-32 h-32 rounded-full object-cover mb-4 border-2 border-white/20"
                        />
                      ) : (
                        <div className="w-32 h-32 rounded-full bg-white/10 flex items-center justify-center text-white/30 text-5xl mb-4 border-2 border-white/20">
                          👤
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="text-sm text-white/50 border border-white/20 px-4 py-2 rounded"
                      >
                        {uploadingImage ? 'UPLOAD...' : editingBarber.image_url ? 'PROMENI SLIKU' : 'DODAJ SLIKU'}
                      </button>
                    </div>

                    <div className="mb-4">
                      <label className="block text-white/40 text-xs mb-2">IME</label>
                      <input
                        type="text"
                        value={editingBarber.name}
                        onChange={(e) => setEditingBarber({ ...editingBarber, name: e.target.value })}
                        onBlur={(e) => updateBarberName(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white"
                      />
                    </div>

                    <div className="mb-6">
                      <label className="block text-white/40 text-xs mb-2">LOKACIJA</label>
                      <p className="text-white/50 bg-white/5 rounded-lg px-4 py-3">{editingBarber.locations?.name}</p>
                    </div>

                    {!editingBarber.is_admin && (
                      <button
                        onClick={() => deleteBarber(editingBarber.id)}
                        className="w-full bg-red-500/20 text-red-400 py-3 rounded-lg font-medium"
                      >
                        OBRISI BERBERA
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {editingService && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center p-4">
          <div className="bg-neutral-900 w-full max-w-md rounded-t-2xl p-6">
            <h3 className="text-lg font-medium mb-4">{editingService.name}</h3>
            <div className="mb-4">
              <label className="block text-white/40 text-xs mb-2">CENA (RSD)</label>
              <input
                type="number"
                value={newServicePrice}
                onChange={(e) => setNewServicePrice(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-lg"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setEditingService(null); setNewServicePrice(''); }}
                className="flex-1 bg-white/10 text-white py-3 rounded-lg"
              >
                OTKAZI
              </button>
              <button
                onClick={updateServicePrice}
                className="flex-1 bg-white text-black py-3 rounded-lg font-medium"
              >
                SACUVAJ
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        select option {
          background: #171717;
          color: white;
        }
        .animate-slide-down {
          animation: slideDown 0.3s ease-out;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
