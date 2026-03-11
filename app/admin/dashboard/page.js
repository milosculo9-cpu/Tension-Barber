'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

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

const dayNames = ['NED', 'PON', 'UTO', 'SRE', 'ČET', 'PET', 'SUB'];
const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAJ', 'JUN', 'JUL', 'AVG', 'SEP', 'OKT', 'NOV', 'DEC'];

export default function Dashboard() {
  const [barber, setBarber] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState({ total: 0, today: 0, revenue: 0 });
  const [activeTab, setActiveTab] = useState('slots');
  const [saving, setSaving] = useState(false);
  
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
    setLoading(false);
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
    if (!confirm('Da li ste sigurni da želite da otkažete ovu rezervaciju?')) return;
    
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
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-[#C6A962] text-xl">Učitavanje...</div>
      </div>
    );
  }

  const timeSlots = generateTimeSlots(barber.locations?.name);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="bg-[#111111] border-b border-[#222222] px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold tracking-wider">
              TENSION <span className="text-[#C6A962]">ADMIN</span>
            </h1>
            {barber.is_admin && (
              <span className="bg-[#C6A962] text-black text-xs px-2 py-1 rounded font-semibold">ADMIN</span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-white font-medium">{barber.name}</p>
              <p className="text-[#666666] text-sm">{barber.locations?.name}</p>
            </div>
            <button onClick={handleLogout} className="text-[#666666] hover:text-white transition-colors text-sm">
              ODJAVA
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-[#111111] border-b border-[#222222]">
        <div className="max-w-6xl mx-auto flex">
          {[
            { id: 'slots', label: 'TERMINI' },
            { id: 'appointments', label: 'REZERVACIJE' },
            { id: 'stats', label: 'STATISTIKA' },
            ...(barber.is_admin ? [{ id: 'admin', label: 'PODEŠAVANJA' }] : [])
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-sm tracking-wide transition-colors relative
                ${activeTab === tab.id ? 'text-[#C6A962]' : 'text-[#666666] hover:text-white'}`}
            >
              {tab.label}
              {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C6A962]" />}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-4">
        {activeTab === 'slots' && (
          <div className="space-y-6">
            <div className="bg-[#111111] border border-[#222222] rounded-lg p-4">
              <h2 className="text-[#C6A962] text-sm tracking-wide mb-4">IZABERI DATUM</h2>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {days.map((day, i) => {
                  const isSelected = formatDate(day) === formatDate(selectedDate);
                  const isToday = formatDate(day) === formatDate(new Date());
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(day)}
                      className={`flex-shrink-0 w-16 py-3 rounded-lg text-center transition-all
                        ${isSelected ? 'bg-[#C6A962] text-black' : 'bg-[#1a1a1a] hover:bg-[#222222] text-white'}
                        ${isToday && !isSelected ? 'ring-1 ring-[#C6A962]' : ''}`}
                    >
                      <div className="text-xs opacity-70">{dayNames[day.getDay()]}</div>
                      <div className="text-xl font-bold">{day.getDate()}</div>
                      <div className="text-xs opacity-70">{monthNames[day.getMonth()]}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-[#111111] border border-[#222222] rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[#C6A962] text-sm tracking-wide">
                  SLOBODNI TERMINI - {selectedDate.getDate()}. {monthNames[selectedDate.getMonth()]}
                </h2>
                <div className="flex gap-2">
                  <button onClick={selectAllSlots} disabled={saving}
                    className="text-xs bg-[#1a1a1a] hover:bg-[#222222] px-3 py-1.5 rounded transition-colors">
                    OZNAČI SVE
                  </button>
                  <button onClick={clearAllSlots} disabled={saving}
                    className="text-xs bg-[#1a1a1a] hover:bg-[#222222] px-3 py-1.5 rounded transition-colors">
                    OBRIŠI SVE
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {timeSlots.map(time => {
                  const isAvailable = availableSlots.includes(time);
                  return (
                    <button
                      key={time}
                      onClick={() => toggleSlot(time)}
                      disabled={saving}
                      className={`py-3 rounded text-sm font-medium transition-all
                        ${isAvailable ? 'bg-[#C6A962] text-black' : 'bg-[#1a1a1a] text-[#666666] hover:bg-[#222222] hover:text-white'}
                        ${saving ? 'opacity-50' : ''}`}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
              
              <p className="text-[#444444] text-xs mt-4">
                Klikni na termin da ga označiš kao slobodan. Zlatni termini su dostupni za rezervaciju.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'appointments' && (
          <div className="bg-[#111111] border border-[#222222] rounded-lg">
            <div className="p-4 border-b border-[#222222]">
              <h2 className="text-[#C6A962] text-sm tracking-wide">PREDSTOJEĆE REZERVACIJE</h2>
            </div>
            
            {appointments.filter(a => a.status !== 'cancelled').length === 0 ? (
              <div className="p-8 text-center text-[#666666]">Nema predstojećih rezervacija</div>
            ) : (
              <div className="divide-y divide-[#222222]">
                {appointments.filter(a => a.status !== 'cancelled').map(apt => (
                  <div key={apt.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{apt.customer_name}</p>
                      <p className="text-[#C6A962] text-sm">{apt.service_name}</p>
                      <p className="text-[#666666] text-sm">
                        {new Date(apt.appointment_date).toLocaleDateString('sr-RS')} u {apt.appointment_time?.slice(0, 5)}
                      </p>
                      {apt.customer_phone && <p className="text-[#666666] text-sm">📞 {apt.customer_phone}</p>}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[#C6A962] font-medium">{apt.service_price?.toLocaleString()} RSD</span>
                      <button onClick={() => cancelAppointment(apt.id)} className="text-red-500 hover:text-red-400 text-sm">
                        OTKAŽI
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#111111] border border-[#222222] rounded-lg p-6">
              <p className="text-[#666666] text-sm tracking-wide">DANAS</p>
              <p className="text-4xl font-bold text-white mt-2">{stats.today}</p>
              <p className="text-[#666666] text-sm mt-1">rezervacija</p>
            </div>
            <div className="bg-[#111111] border border-[#222222] rounded-lg p-6">
              <p className="text-[#666666] text-sm tracking-wide">UKUPNO</p>
              <p className="text-4xl font-bold text-[#C6A962] mt-2">{stats.total}</p>
              <p className="text-[#666666] text-sm mt-1">rezervacija</p>
            </div>
            <div className="bg-[#111111] border border-[#222222] rounded-lg p-6">
              <p className="text-[#666666] text-sm tracking-wide">ZARADA</p>
              <p className="text-4xl font-bold text-white mt-2">{stats.revenue.toLocaleString()}</p>
              <p className="text-[#666666] text-sm mt-1">RSD</p>
            </div>
          </div>
        )}

        {activeTab === 'admin' && barber.is_admin && (
          <div className="bg-[#111111] border border-[#222222] rounded-lg p-6">
            <h2 className="text-[#C6A962] text-sm tracking-wide mb-4">ADMIN PODEŠAVANJA</h2>
            <p className="text-[#666666]">Admin funkcionalnosti dolaze uskoro...</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <button className="bg-[#1a1a1a] hover:bg-[#222222] p-4 rounded-lg text-center transition-colors">
                <span className="text-2xl">💰</span>
                <p className="text-sm mt-2">Cenovnik</p>
              </button>
              <button className="bg-[#1a1a1a] hover:bg-[#222222] p-4 rounded-lg text-center transition-colors">
                <span className="text-2xl">👤</span>
                <p className="text-sm mt-2">Berberi</p>
              </button>
              <button className="bg-[#1a1a1a] hover:bg-[#222222] p-4 rounded-lg text-center transition-colors">
                <span className="text-2xl">🖼️</span>
                <p className="text-sm mt-2">Slike</p>
              </button>
              <button className="bg-[#1a1a1a] hover:bg-[#222222] p-4 rounded-lg text-center transition-colors">
                <span className="text-2xl">🕐</span>
                <p className="text-sm mt-2">Radno vreme</p>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
