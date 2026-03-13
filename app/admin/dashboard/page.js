'use client';

import { useState, useEffect, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

const STORAGE_URL = 'https://ygczcwuwmxhnbbfipfby.supabase.co/storage/v1/object/public';

const generateTimeSlots = (locationName, duration = 30) => {
  const slots = [];
  const startHour = 0;  // 00:00
  const endHour = 24;   // 24:00
  
  // Convert to minutes for easier calculation
  const startMinutes = startHour * 60;
  const endMinutes = endHour * 60;
  
  let currentMinutes = startMinutes;
  
  while (currentMinutes + duration <= endMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const mins = currentMinutes % 60;
    slots.push(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
    currentMinutes += duration;
  }
  
  return slots;
};

const DURATION_OPTIONS = [15, 20, 25, 30, 40, 45, 60];

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
  const [showPastAppointments, setShowPastAppointments] = useState(null); // 'today' | 'total' | null
  const [pastAppointments, setPastAppointments] = useState([]);
  const [slotDuration, setSlotDuration] = useState(30); // default 30 minutes
  const [bookedSlots, setBookedSlots] = useState([]); // slots that are booked (green)
  
  // Manual booking form
  const [showManualBooking, setShowManualBooking] = useState(false);
  const [manualBookingSlot, setManualBookingSlot] = useState(null);
  const [manualBookingForm, setManualBookingForm] = useState({ name: '', phone: '' });
  
  // Service management
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [showAddService, setShowAddService] = useState(false);
  
  const [editingService, setEditingService] = useState(null);
  const [editingBarber, setEditingBarber] = useState(null);
  const [showAddBarber, setShowAddBarber] = useState(false);
  const [newBarberName, setNewBarberName] = useState('');
  const [newBarberLocation, setNewBarberLocation] = useState('');
  const [editServicePrice, setEditServicePrice] = useState('');
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

  // Change tab and scroll to top
  const changeTab = (tabId) => {
    setActiveTab(tabId);
    setAdminSection(null);
    window.scrollTo(0, 0);
  };

  // Swipe handler for tabs
  const datePickerRef = useRef(null);
  
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let touchTarget = null;
    
    const handleTouchStart = (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      touchTarget = e.target;
    };

    const handleTouchEnd = (e) => {
      // Don't change tabs if swipe started on date picker
      if (datePickerRef.current && datePickerRef.current.contains(touchTarget)) {
        return;
      }
      
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      
      const diffX = startX - endX;
      const diffY = startY - endY;
      
      // Only trigger if horizontal movement is dominant and significant
      if (Math.abs(diffX) > Math.abs(diffY) * 2.5 && Math.abs(diffX) > 80) {
        const availableTabs = barber?.is_admin ? tabs : tabs.filter(t => t.id !== 'podesavanja');
        const currentIndex = availableTabs.findIndex(t => t.id === activeTab);
        
        if (diffX > 0 && currentIndex < availableTabs.length - 1) {
          changeTab(availableTabs[currentIndex + 1].id);
        } else if (diffX < 0 && currentIndex > 0) {
          changeTab(availableTabs[currentIndex - 1].id);
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [activeTab, barber]);

  useEffect(() => {
    loadBarberData();
  }, []);

  useEffect(() => {
    if (barber) {
      loadSlotsForDate();
      loadAppointments();
    }
  }, [selectedDate, barber]);

  // Real-time subscription for new appointments and slot changes
  useEffect(() => {
    if (!barber) return;

    const appointmentsChannel = supabase
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
          setNewAppointmentAlert(payload.new);
          loadAppointments();
          loadStats(barber.id);
          loadSlotsForDate(); // Reload slots to show booked
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

    const slotsChannel = supabase
      .channel('slots-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'barber_available_slots',
          filter: `barber_id=eq.${barber.id}`
        },
        () => {
          loadSlotsForDate(); // Reload slots on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(slotsChannel);
    };
  }, [barber, selectedDate]);

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
    const { data } = await supabase.from('services').select('*').order('display_order');
    if (data) setServices(data.map(s => ({ ...s, price: s.price ? parseFloat(s.price) : null })));
  };

  const loadAllBarbers = async () => {
    const { data } = await supabase.from('barbers').select('*, locations(name)').order('name');
    if (data) setAllBarbers(data);
  };

  const loadLocations = async () => {
    const { data } = await supabase.from('locations').select('*');
    if (data) setLocations(data);
  };

  const saveSlotDuration = async (duration) => {
    const dateStr = formatDate(selectedDate);
    setSlotDuration(duration);
    
    // Upsert duration setting
    await supabase
      .from('barber_slot_settings')
      .upsert({
        barber_id: barber.id,
        slot_date: dateStr,
        slot_duration: duration
      }, {
        onConflict: 'barber_id,slot_date'
      });
    
    // Clear existing slots when duration changes
    await supabase
      .from('barber_available_slots')
      .delete()
      .eq('barber_id', barber.id)
      .eq('slot_date', dateStr);
    
    setAvailableSlots([]);
  };

  const loadSlotsForDate = async () => {
    const dateStr = formatDate(selectedDate);
    
    // Load slot duration first
    const { data: durationData } = await supabase
      .from('barber_slot_settings')
      .select('slot_duration')
      .eq('barber_id', barber.id)
      .eq('slot_date', dateStr)
      .single();
    
    if (durationData) {
      setSlotDuration(durationData.slot_duration);
    } else {
      setSlotDuration(30);
    }
    
    // Load available slots
    const { data } = await supabase
      .from('barber_available_slots')
      .select('*')
      .eq('barber_id', barber.id)
      .eq('slot_date', dateStr);

    if (data) {
      setAvailableSlots(data.filter(s => !s.is_booked).map(s => s.slot_time.slice(0, 5)));
      setBookedSlots(data.filter(s => s.is_booked).map(s => s.slot_time.slice(0, 5)));
    } else {
      setAvailableSlots([]);
      setBookedSlots([]);
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
    const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    
    const { count: total } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('barber_id', barberId)
      .in('status', ['confirmed', 'needs_call'])
      .gte('appointment_date', thirtyDaysAgo);

    const { count: todayCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('barber_id', barberId)
      .eq('appointment_date', today)
      .in('status', ['confirmed', 'needs_call']);

    const { data: revenueData } = await supabase
      .from('appointments')
      .select('service_price')
      .eq('barber_id', barberId)
      .in('status', ['confirmed', 'needs_call'])
      .gte('appointment_date', thirtyDaysAgo);

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
    const allSlots = generateTimeSlots(barber.locations?.name, slotDuration);
    
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

  // Manual booking by barber
  const handleManualBooking = async (e) => {
    e.preventDefault();
    if (!manualBookingSlot || !manualBookingForm.name || !manualBookingForm.phone) return;
    
    setSaving(true);
    const dateStr = formatDate(selectedDate);
    
    // Create appointment
    await supabase
      .from('appointments')
      .insert({
        barber_id: barber.id,
        service_name: 'Ručna rezervacija',
        service_price: 0,
        customer_name: manualBookingForm.name,
        customer_phone: manualBookingForm.phone,
        appointment_date: dateStr,
        appointment_time: manualBookingSlot + ':00',
        status: 'confirmed'
      });
    
    // Mark slot as booked
    await supabase
      .from('barber_available_slots')
      .update({ is_booked: true })
      .eq('barber_id', barber.id)
      .eq('slot_date', dateStr)
      .eq('slot_time', manualBookingSlot + ':00');
    
    // Reset form
    setShowManualBooking(false);
    setManualBookingSlot(null);
    setManualBookingForm({ name: '', phone: '' });
    
    loadSlotsForDate();
    loadAppointments();
    loadStats(barber.id);
    setSaving(false);
  };

  // Add new service
  const addService = async () => {
    if (!newServiceName.trim()) return;
    
    const price = newServicePrice ? parseInt(newServicePrice) : null;
    
    await supabase
      .from('services')
      .insert({
        name: newServiceName.trim(),
        price: price,
        display_order: services.length + 1
      });
    
    setNewServiceName('');
    setNewServicePrice('');
    setShowAddService(false);
    
    // Reload services
    const { data } = await supabase.from('services').select('*').order('display_order');
    if (data) setServices(data.map(s => ({ ...s, price: s.price ? parseFloat(s.price) : null })));
  };

  // Delete service
  const deleteService = async (serviceId) => {
    if (!confirm('Obrisati ovu uslugu?')) return;
    
    await supabase
      .from('services')
      .delete()
      .eq('id', serviceId);
    
    // Reload services
    const { data } = await supabase.from('services').select('*').order('display_order');
    if (data) setServices(data.map(s => ({ ...s, price: s.price ? parseFloat(s.price) : null })));
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

  const loadPastAppointments = async (type) => {
    if (!barber) return;
    
    const today = formatDate(new Date());
    const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    
    let query = supabase
      .from('appointments')
      .select('*')
      .eq('barber_id', barber.id)
      .neq('status', 'cancelled')
      .gte('appointment_date', thirtyDaysAgo)
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: false });
    
    if (type === 'today') {
      query = query.eq('appointment_date', today);
    }
    
    const { data } = await query;
    setPastAppointments(data || []);
    setShowPastAppointments(type);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin');
  };

  const updateServicePrice = async () => {
    if (!editingService || !editServicePrice) return;
    
    const price = parseInt(editServicePrice);
    if (isNaN(price)) return;
    
    await supabase
      .from('services')
      .update({ price })
      .eq('id', editingService.id);
    
    setEditingService(null);
    setEditServicePrice('');
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
    const fileName = `${editingBarber.name.toLowerCase()
      .replace(/đ/g, 'dj')
      .replace(/č/g, 'c')
      .replace(/ć/g, 'c')
      .replace(/š/g, 's')
      .replace(/ž/g, 'z')
      .replace(/[^a-z]/g, '')}.${fileExt}`;
    
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

  const timeSlots = generateTimeSlots(barber.locations?.name, slotDuration);
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
              <div ref={datePickerRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
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
              <h2 className="text-white/40 text-xs tracking-wider mb-3">TRAJANJE TERMINA</h2>
              <div className="grid grid-cols-7 gap-2">
                {DURATION_OPTIONS.map(duration => (
                  <button
                    key={duration}
                    onClick={() => saveSlotDuration(duration)}
                    disabled={slotsLocked}
                    className={`py-3 rounded text-sm font-medium transition-all
                      ${slotDuration === duration ? 'bg-white text-black' : 'bg-white/5 text-white/40'}
                      ${slotsLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {duration === 60 ? '1h' : `${duration}`}
                  </button>
                ))}
              </div>
              <p className="text-white/30 text-xs mt-2 text-center">
                Trenutno: {slotDuration === 60 ? '1 sat' : `${slotDuration} min`}
              </p>
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
                  const isBooked = bookedSlots.includes(time);
                  return (
                    <button
                      key={time}
                      onClick={() => {
                        if (isBooked) return; // Can't toggle booked slots
                        if (slotsLocked && isAvailable) {
                          // Open manual booking
                          setManualBookingSlot(time);
                          setShowManualBooking(true);
                        } else {
                          toggleSlot(time);
                        }
                      }}
                      disabled={saving || (slotsLocked && !isAvailable && !isBooked)}
                      className={`py-3 rounded text-sm font-medium transition-all
                        ${isBooked ? 'bg-green-600 text-white' : ''}
                        ${isAvailable && !isBooked ? 'bg-white text-black' : ''}
                        ${!isAvailable && !isBooked ? 'bg-white/5 text-white/40' : ''}
                        ${saving ? 'opacity-50' : ''}
                        ${isBooked ? 'cursor-default' : ''}`}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
              
              <div className="flex gap-4 mt-3 justify-center text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-white rounded"></span> Slobodan</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-600 rounded"></span> Zakazan</span>
              </div>
              
              {slotsLocked && (
                <p className="text-green-400 text-xs mt-3 text-center">✓ Termini su zakljucani - klikni na slobodan termin za rucno zakazivanje</p>
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
            
            {appointments.filter(a => {
              if (a.status === 'cancelled') return false;
              // Hide appointments that started more than 30 minutes ago
              const now = new Date();
              const aptDate = new Date(a.appointment_date);
              const [hours, minutes] = (a.appointment_time || '00:00').split(':').map(Number);
              aptDate.setHours(hours, minutes, 0, 0);
              const thirtyMinAfterStart = new Date(aptDate.getTime() + 30 * 60 * 1000);
              return now < thirtyMinAfterStart;
            }).length === 0 ? (
              <div className="text-center text-white/30 py-12">Nema rezervacija</div>
            ) : (
              <div className="space-y-3">
                {appointments.filter(a => {
                  if (a.status === 'cancelled') return false;
                  const now = new Date();
                  const aptDate = new Date(a.appointment_date);
                  const [hours, minutes] = (a.appointment_time || '00:00').split(':').map(Number);
                  aptDate.setHours(hours, minutes, 0, 0);
                  const thirtyMinAfterStart = new Date(aptDate.getTime() + 30 * 60 * 1000);
                  return now < thirtyMinAfterStart;
                }).map(apt => (
                  <div 
                    key={apt.id} 
                    className={`rounded-lg p-4 ${
                      apt.status === 'needs_call' 
                        ? 'bg-gradient-to-r from-orange-500/20 to-orange-600/10 border border-orange-500/30' 
                        : 'bg-white/5'
                    }`}
                  >
                    {apt.status === 'needs_call' && (
                      <div className="flex items-center gap-2 mb-2 text-orange-400 text-xs font-medium">
                        <span>📞</span> POZOVI KLIJENTA
                      </div>
                    )}
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{apt.customer_name}</p>
                        <p className="text-white/50 text-sm">{apt.service_name}</p>
                        <p className="text-white/30 text-sm mt-1">
                          {new Date(apt.appointment_date).toLocaleDateString('sr-RS')} • {apt.appointment_time?.slice(0, 5)}
                        </p>
                        {apt.customer_phone && (
                          <a href={`tel:${apt.customer_phone}`} className={`text-sm mt-1 inline-block ${
                            apt.status === 'needs_call' ? 'text-orange-300 font-medium' : 'text-white/40 hover:text-white'
                          }`}>
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
            <button 
              onClick={() => loadPastAppointments('today')}
              className="bg-white/5 rounded-lg p-6 text-center hover:bg-white/10 transition"
            >
              <p className="text-white/40 text-xs tracking-wider">DANAS</p>
              <p className="text-4xl font-light mt-2">{stats.today}</p>
              <p className="text-white/30 text-sm">rezervacija</p>
              <p className="text-white/20 text-xs mt-2">Klikni za detalje →</p>
            </button>
            <button 
              onClick={() => loadPastAppointments('total')}
              className="bg-white/5 rounded-lg p-6 text-center hover:bg-white/10 transition"
            >
              <p className="text-white/40 text-xs tracking-wider">UKUPNO (30 dana)</p>
              <p className="text-4xl font-light mt-2">{stats.total}</p>
              <p className="text-white/30 text-sm">rezervacija</p>
              <p className="text-white/20 text-xs mt-2">Klikni za detalje →</p>
            </button>
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
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-white/40 text-xs tracking-wider">CENOVNIK</h2>
                      <button onClick={() => setShowAddService(true)} className="text-xs bg-white text-black px-3 py-1 rounded">
                        + DODAJ
                      </button>
                    </div>
                    
                    {showAddService && (
                      <div className="bg-white/10 rounded-lg p-4 mb-4 space-y-3">
                        <input
                          type="text"
                          value={newServiceName}
                          onChange={(e) => setNewServiceName(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white"
                          placeholder="Naziv usluge"
                        />
                        <input
                          type="number"
                          value={newServicePrice}
                          onChange={(e) => setNewServicePrice(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white"
                          placeholder="Cena (ostaviti prazno za 'po dogovoru')"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => setShowAddService(false)} className="flex-1 py-2 rounded bg-white/10 text-white text-sm">
                            Otkaži
                          </button>
                          <button onClick={addService} className="flex-1 py-2 rounded bg-white text-black text-sm font-medium">
                            Dodaj
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      {services.map(service => (
                        <div
                          key={service.id}
                          className="w-full bg-white/5 rounded-lg p-4 flex justify-between items-center"
                        >
                          <button
                            onClick={() => { setEditingService(service); setEditServicePrice(service.price?.toString() || ''); }}
                            className="flex-1 flex justify-between items-center text-left"
                          >
                            <span className="text-sm">{service.name}</span>
                            <span className="text-white/50">{service.price ? `${service.price.toLocaleString()} RSD` : 'po dogovoru'}</span>
                          </button>
                          <button
                            onClick={() => deleteService(service.id)}
                            className="ml-3 text-red-400 hover:text-red-300 p-1"
                          >
                            ✕
                          </button>
                        </div>
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
                value={editServicePrice}
                onChange={(e) => setEditServicePrice(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-lg"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setEditingService(null); setEditServicePrice(''); }}
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

      {/* Past Appointments Modal */}
      {showPastAppointments && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPastAppointments(null)}
        >
          <div 
            className="bg-zinc-900 rounded-xl w-full max-w-md max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-700 flex justify-between items-center">
              <h3 className="font-medium text-lg">
                {showPastAppointments === 'today' ? 'Današnje rezervacije' : 'Rezervacije (30 dana)'}
              </h3>
              <button 
                onClick={() => setShowPastAppointments(null)}
                className="text-white/50 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-4">
              {pastAppointments.length === 0 ? (
                <div className="text-center text-white/30 py-8">Nema rezervacija</div>
              ) : (
                <div className="space-y-3">
                  {pastAppointments.map(apt => {
                    const aptDate = new Date(apt.appointment_date);
                    const [hours, minutes] = (apt.appointment_time || '00:00').split(':').map(Number);
                    aptDate.setHours(hours, minutes, 0, 0);
                    const isPast = new Date() > new Date(aptDate.getTime() + 30 * 60 * 1000);
                    
                    return (
                      <div 
                        key={apt.id} 
                        className={`rounded-lg p-3 ${isPast ? 'bg-white/5 opacity-60' : 'bg-white/10'}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">{apt.customer_name}</p>
                            <p className="text-white/50 text-xs">{apt.service_name}</p>
                            <p className="text-white/30 text-xs mt-1">
                              {new Date(apt.appointment_date).toLocaleDateString('sr-RS')} • {apt.appointment_time?.slice(0, 5)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-sm">{apt.service_price?.toLocaleString()} RSD</p>
                            {isPast && (
                              <span className="text-green-400 text-xs">✓ Završeno</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-zinc-700 text-center">
              <p className="text-white/30 text-sm">
                Ukupna zarada: <span className="text-white font-medium">
                  {pastAppointments.reduce((sum, a) => sum + (a.service_price || 0), 0).toLocaleString()} RSD
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Manual Booking Modal */}
      {showManualBooking && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowManualBooking(false)}
        >
          <div 
            className="bg-zinc-900 rounded-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-700">
              <h3 className="font-medium text-lg">Zakaži termin</h3>
              <p className="text-white/50 text-sm">
                {formatDate(selectedDate)} u {manualBookingSlot}
              </p>
            </div>
            <form onSubmit={handleManualBooking} className="p-4 space-y-4">
              <div>
                <label className="block text-white/50 text-xs mb-1">Ime klijenta</label>
                <input
                  type="text"
                  value={manualBookingForm.name}
                  onChange={(e) => setManualBookingForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white"
                  placeholder="Ime i prezime"
                  required
                />
              </div>
              <div>
                <label className="block text-white/50 text-xs mb-1">Telefon</label>
                <input
                  type="tel"
                  value={manualBookingForm.phone}
                  onChange={(e) => setManualBookingForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white"
                  placeholder="06x xxx xxxx"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualBooking(false)}
                  className="flex-1 py-3 rounded-lg bg-white/10 text-white"
                >
                  Otkaži
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 rounded-lg bg-white text-black font-medium"
                >
                  {saving ? 'Čuvanje...' : 'Zakaži'}
                </button>
              </div>
            </form>
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
