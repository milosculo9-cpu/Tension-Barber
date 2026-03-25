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
  
  // Find the most recent Wednesday (or today if it's Wednesday)
  // Sunday = 0, Monday = 1, Tuesday = 2, Wednesday = 3, etc.
  const dayOfWeek = today.getDay();
  const daysFromWednesday = dayOfWeek >= 3 ? dayOfWeek - 3 : dayOfWeek + 4;
  
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - daysFromWednesday);
  
  // Generate 14 days starting from that Wednesday
  for (let i = 0; i < 14; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
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
  const [blacklist, setBlacklist] = useState([]);
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
  const [manualBookingForm, setManualBookingForm] = useState({ name: '', phone: '', serviceId: '', additionalServiceId: '' });
  const [allServices, setAllServices] = useState([]);
  
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
  
  // Appointment detail modal
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  
  // Barber auth fields
  const [newBarberEmail, setNewBarberEmail] = useState('');
  const [newBarberPassword, setNewBarberPassword] = useState('');
  const [newBarberImage, setNewBarberImage] = useState(null);
  const [newBarberImagePreview, setNewBarberImagePreview] = useState(null);
  const [editingBarberEmail, setEditingBarberEmail] = useState('');
  const [editingBarberPassword, setEditingBarberPassword] = useState('');
  const [savingAuth, setSavingAuth] = useState(false);
  
  // Blocked slot without appointment
  const [blockedSlotTime, setBlockedSlotTime] = useState(null);
  
  // All appointments view (for Crni, Kole, Anđelo)
  const [allAppointmentsData, setAllAppointmentsData] = useState([]);
  const [allAppointmentsDate, setAllAppointmentsDate] = useState(new Date());
  const [selectedBarberFilter, setSelectedBarberFilter] = useState('all');
  const [allBarberSlots, setAllBarberSlots] = useState({}); // { barberId: { available: [], booked: [], duration: 30 } }
  const [selectedBarberForBooking, setSelectedBarberForBooking] = useState(null);
  const [allViewManualBookingSlot, setAllViewManualBookingSlot] = useState(null);
  const [showAllViewManualBooking, setShowAllViewManualBooking] = useState(false);
  
  const fileInputRef = useRef(null);
  const newBarberFileInputRef = useRef(null);
  const router = useRouter();
  const supabase = createClientComponentClient();
  const days = getNext14Days();

  // IDs of barbers who can see all appointments (Crni, Kole, Anđelo)
  const canSeeAllAppointments = [
    '4112f49c-3106-412a-a1a4-4b41a758a943', // Crni
    'c39c8070-1e50-43f4-a97a-a8f5d30f7690', // Kole
    '891bb22f-8377-4dc7-b14a-c7544aee6276'  // Anđelo
  ];

  const tabs = [
    { id: 'svi-termini', label: 'Svi Termini' },
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
      loadSlotsLockedState();
    }
  }, [selectedDate, barber]);

  // Load all appointments when viewing 'svi-termini' tab
  useEffect(() => {
    if (barber && activeTab === 'svi-termini' && canSeeAllAppointments.includes(barber.id)) {
      loadAllAppointments(allAppointmentsDate);
    }
  }, [allAppointmentsDate, activeTab, barber]);

  // Load slots locked state from database
  const loadSlotsLockedState = async () => {
    const dateStr = formatDate(selectedDate);
    const { data } = await supabase
      .from('barber_day_locks')
      .select('is_locked')
      .eq('barber_id', barber.id)
      .eq('lock_date', dateStr)
      .single();
    
    setSlotsLocked(data?.is_locked || false);
  };

  // Toggle slots locked state and save to database
  const toggleSlotsLocked = async () => {
    const dateStr = formatDate(selectedDate);
    const newLockedState = !slotsLocked;
    
    await supabase
      .from('barber_day_locks')
      .upsert({
        barber_id: barber.id,
        lock_date: dateStr,
        is_locked: newLockedState
      }, {
        onConflict: 'barber_id,lock_date'
      });
    
    setSlotsLocked(newLockedState);
  };

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
    await loadAllActiveServices(); // Load services for manual booking
    
    // IDs of barbers who can see all appointments (Crni, Kole, Anđelo)
    const canSeeAll = [
      '4112f49c-3106-412a-a1a4-4b41a758a943', // Crni
      'c39c8070-1e50-43f4-a97a-a8f5d30f7690', // Kole
      '891bb22f-8377-4dc7-b14a-c7544aee6276'  // Anđelo
    ];
    
    // Load data for "Svi Termini" tab
    if (canSeeAll.includes(barberData.id)) {
      loadAllBarbers();
      loadLocations();
    }
    
    if (barberData.is_admin) {
      loadServices();
    }
    
    setLoading(false);
  };

  // Load all active services for manual booking dropdown
  const loadAllActiveServices = async () => {
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('is_active', true)
      .order('is_additional')
      .order('display_order');
    if (data) setAllServices(data.map(s => ({ ...s, price: s.price ? parseFloat(s.price) : null })));
  };

  const loadServices = async () => {
    const { data } = await supabase.from('services').select('*').order('display_order');
    if (data) setServices(data.map(s => ({ ...s, price: s.price ? parseFloat(s.price) : null })));
  };

  const loadAllBarbers = async () => {
    const { data } = await supabase.from('barbers').select('*, locations(name)').order('display_order');
    if (data) setAllBarbers(data);
  };

  const loadLocations = async () => {
    const { data } = await supabase.from('locations').select('*');
    if (data) setLocations(data);
  };

  const saveSlotDuration = async (duration) => {
    const dateStr = formatDate(selectedDate);
    
    // Check if there are already selected slots for this date
    const { data: existingSlots } = await supabase
      .from('barber_available_slots')
      .select('*')
      .eq('barber_id', barber.id)
      .eq('slot_date', dateStr);
    
    if (existingSlots && existingSlots.length > 0) {
      // There are existing slots - show confirmation
      const bookedCount = existingSlots.filter(s => s.is_booked).length;
      const availableCount = existingSlots.filter(s => !s.is_booked).length;
      
      let message = `Da li želite da promenite trajanje termina za ${dateStr}?\n\n`;
      message += `Ovo će obrisati sve označene termine:\n`;
      message += `- Slobodni termini: ${availableCount}\n`;
      if (bookedCount > 0) {
        message += `- ZAKAZANI TERMINI: ${bookedCount} (ovi termini će biti OTKAZANI!)\n`;
      }
      message += `\nDa li ste sigurni?`;
      
      if (!confirm(message)) {
        return; // User cancelled, don't change duration
      }
    }
    
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
    setBookedSlots([]);
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
    
    // Load blacklist
    const { data: blacklistData } = await supabase
      .from('blacklist')
      .select('*');
    
    if (blacklistData) {
      setBlacklist(blacklistData);
    }
  };

  // Load all appointments for all barbers (for Crni, Kole, Anđelo view)
  const loadAllAppointments = async (date) => {
    const dateStr = formatDate(date || allAppointmentsDate);
    
    // Load appointments
    const { data } = await supabase
      .from('appointments')
      .select('*, barbers(name, location_id, locations(name))')
      .eq('appointment_date', dateStr)
      .neq('status', 'cancelled')
      .order('appointment_time', { ascending: true });
    
    if (data) {
      setAllAppointmentsData(data);
    }
    
    // Load slots for ALL barbers
    const { data: allSlots } = await supabase
      .from('barber_available_slots')
      .select('*')
      .eq('slot_date', dateStr);
    
    // Load slot durations for ALL barbers
    const { data: allDurations } = await supabase
      .from('barber_slot_settings')
      .select('*')
      .eq('slot_date', dateStr);
    
    // Organize by barber
    const slotsByBarber = {};
    allBarbers.forEach(b => {
      const barberSlots = allSlots?.filter(s => s.barber_id === b.id) || [];
      const barberDuration = allDurations?.find(d => d.barber_id === b.id)?.slot_duration || 30;
      slotsByBarber[b.id] = {
        available: barberSlots.filter(s => !s.is_booked).map(s => s.slot_time.slice(0, 5)),
        booked: barberSlots.filter(s => s.is_booked).map(s => s.slot_time.slice(0, 5)),
        duration: barberDuration
      };
    });
    
    setAllBarberSlots(slotsByBarber);
  };

  // Book slot for any barber (from all-view)
  const bookSlotForBarber = async (targetBarber, time, customerData) => {
    const dateStr = formatDate(allAppointmentsDate);
    
    // Create appointment
    const { error } = await supabase
      .from('appointments')
      .insert({
        barber_id: targetBarber.id,
        customer_name: customerData.name,
        customer_phone: customerData.phone,
        service_id: customerData.service_id,
        service_name: customerData.service_name,
        service_price: customerData.service_price,
        appointment_date: dateStr,
        appointment_time: time + ':00',
        status: 'confirmed',
        duration_minutes: customerData.duration || 30
      });
    
    if (error) {
      console.error('Error creating appointment:', error);
      return false;
    }
    
    // Mark slot as booked
    await supabase
      .from('barber_available_slots')
      .upsert({
        barber_id: targetBarber.id,
        slot_date: dateStr,
        slot_time: time + ':00',
        is_booked: true
      }, {
        onConflict: 'barber_id,slot_date,slot_time'
      });
    
    // Reload
    loadAllAppointments(allAppointmentsDate);
    return true;
  };

  const loadStats = async (barberId) => {
    const today = formatDate(new Date());
    const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    
    const { count: total } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('barber_id', barberId)
      .in('status', ['confirmed', 'needs_call'])
      .eq('no_show', false)
      .gte('appointment_date', thirtyDaysAgo);

    const { count: todayCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('barber_id', barberId)
      .eq('appointment_date', today)
      .in('status', ['confirmed', 'needs_call'])
      .eq('no_show', false);

    const { data: revenueData } = await supabase
      .from('appointments')
      .select('service_price')
      .eq('barber_id', barberId)
      .in('status', ['confirmed', 'needs_call'])
      .eq('no_show', false)
      .gte('appointment_date', thirtyDaysAgo);

    const revenue = revenueData?.reduce((sum, a) => sum + (a.service_price || 0), 0) || 0;

    setStats({ total: total || 0, today: todayCount || 0, revenue });
  };

  // Mark appointment as no-show and add to blacklist
  const markNoShow = async (appointmentId, appointment) => {
    if (!confirm('Označiti da se klijent nije pojavio? Klijent će biti dodat na crnu listu.')) return;
    
    // Mark as no-show
    await supabase
      .from('appointments')
      .update({ no_show: true })
      .eq('id', appointmentId);
    
    // Add to blacklist if phone exists
    if (appointment?.customer_phone) {
      await supabase
        .from('blacklist')
        .insert({
          customer_phone: appointment.customer_phone,
          customer_name: appointment.customer_name,
          missed_appointment_id: appointmentId,
          missed_service_name: appointment.service_name,
          missed_service_price: appointment.service_price,
          missed_date: appointment.appointment_date
        });
    }
    
    setSelectedAppointment(null);
    loadAppointments();
    loadStats(barber.id);
  };

  // Cancel appointment from admin
  const cancelAppointmentAdmin = async (appointment) => {
    if (!confirm('Da li ste sigurni da želite da otkažete ovaj termin?')) return;
    
    // Update appointment status to cancelled
    await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointment.id);
    
    // Free up the slot
    await supabase
      .from('barber_available_slots')
      .update({ is_booked: false })
      .eq('barber_id', barber.id)
      .eq('slot_date', appointment.appointment_date)
      .eq('slot_time', appointment.appointment_time);
    
    setSelectedAppointment(null);
    loadSlotsForDate();
    loadAppointments();
    loadStats(barber.id);
  };

  const toggleSlot = async (time) => {
    if (slotsLocked) return;
    
    const dateStr = formatDate(selectedDate);
    
    if (availableSlots.includes(time)) {
      // Slot is available, remove it (make unavailable)
      setSaving(true);
      await supabase
        .from('barber_available_slots')
        .delete()
        .eq('barber_id', barber.id)
        .eq('slot_date', dateStr)
        .eq('slot_time', time + ':00');
      
      setAvailableSlots(prev => prev.filter(s => s !== time));
      setSaving(false);
    } else {
      // Slot is not available, make it available (white)
      setSaving(true);
      await supabase
        .from('barber_available_slots')
        .insert({
          barber_id: barber.id,
          slot_date: dateStr,
          slot_time: time + ':00',
          is_booked: false
        });
      
      setAvailableSlots(prev => [...prev, time]);
      setSaving(false);
    }
  };

  // Book a slot directly (mark as booked with appointment)
  const bookSlotDirectly = (time) => {
    setManualBookingSlot(time);
    setShowManualBooking(true);
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
    
    // Get selected service details
    const mainService = allServices.find(s => s.id === manualBookingForm.serviceId);
    const additionalService = manualBookingForm.additionalServiceId 
      ? allServices.find(s => s.id === manualBookingForm.additionalServiceId)
      : null;
    
    // Build service name and price
    let serviceName = mainService ? mainService.name : 'Ručna rezervacija';
    let servicePrice = mainService ? (mainService.price || 0) : 0;
    let totalDuration = mainService ? (mainService.duration_minutes || slotDuration) : slotDuration;
    
    if (additionalService) {
      serviceName += ' + ' + additionalService.name;
      servicePrice += additionalService.price || 0;
      totalDuration += additionalService.duration_minutes || 0;
    }
    
    // Create appointment
    const { error } = await supabase
      .from('appointments')
      .insert({
        barber_id: barber.id,
        service_name: serviceName,
        service_price: servicePrice,
        customer_name: manualBookingForm.name,
        customer_email: '',
        customer_phone: manualBookingForm.phone,
        appointment_date: dateStr,
        appointment_time: manualBookingSlot + ':00',
        duration_minutes: totalDuration,
        status: 'confirmed'
      });
    
    if (error) {
      console.error('Error creating appointment:', error);
      alert('Greška pri kreiranju rezervacije: ' + error.message);
      setSaving(false);
      return;
    }
    
    // Mark slot as booked (upsert in case slot doesn't exist)
    await supabase
      .from('barber_available_slots')
      .upsert({
        barber_id: barber.id,
        slot_date: dateStr,
        slot_time: manualBookingSlot + ':00',
        is_booked: true
      }, {
        onConflict: 'barber_id,slot_date,slot_time'
      });
    
    // Reset form
    setShowManualBooking(false);
    setManualBookingSlot(null);
    setManualBookingForm({ name: '', phone: '', serviceId: '', additionalServiceId: '' });
    
    // Reload data
    await loadSlotsForDate();
    await loadAppointments();
    await loadStats(barber.id);
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
    if (!newBarberName || !newBarberLocation || !newBarberEmail || !newBarberPassword) return;
    
    setSavingAuth(true);
    
    try {
      const response = await fetch('/api/manage-barber-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: newBarberName,
          locationId: newBarberLocation,
          email: newBarberEmail,
          password: newBarberPassword
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        alert(result.error || 'Greška pri kreiranju berbera');
        setSavingAuth(false);
        return;
      }
      
      // If image was selected, upload it
      if (newBarberImage && result.barber?.id) {
        const fileExt = newBarberImage.name.split('.').pop().toLowerCase();
        const fileName = `${newBarberName.toLowerCase()
          .replace(/đ/g, 'dj')
          .replace(/č/g, 'c')
          .replace(/ć/g, 'c')
          .replace(/š/g, 's')
          .replace(/ž/g, 'z')
          .replace(/[^a-z]/g, '')}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('barbers')
          .upload(fileName, newBarberImage, { upsert: true });
        
        if (!uploadError) {
          const imageUrl = `${STORAGE_URL}/barbers/${fileName}`;
          await supabase
            .from('barbers')
            .update({ image_url: imageUrl })
            .eq('id', result.barber.id);
        }
      }
      
      setShowAddBarber(false);
      setNewBarberName('');
      setNewBarberLocation('');
      setNewBarberEmail('');
      setNewBarberPassword('');
      setNewBarberImage(null);
      setNewBarberImagePreview(null);
      loadAllBarbers();
    } catch (error) {
      alert('Greška pri kreiranju berbera');
    }
    
    setSavingAuth(false);
  };

  // Update barber login credentials
  const updateBarberAuth = async () => {
    if (!editingBarber || (!editingBarberEmail && !editingBarberPassword)) return;
    
    setSavingAuth(true);
    
    try {
      const response = await fetch('/api/manage-barber-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          barberId: editingBarber.id,
          email: editingBarberEmail || undefined,
          password: editingBarberPassword || undefined
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        alert(result.error || 'Greška pri ažuriranju');
        setSavingAuth(false);
        return;
      }
      
      alert('Login podaci ažurirani!');
      setEditingBarberEmail('');
      setEditingBarberPassword('');
    } catch (error) {
      alert('Greška pri ažuriranju');
    }
    
    setSavingAuth(false);
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
  
  // Determine which tabs to show based on barber permissions
  const canViewAllTerms = canSeeAllAppointments.includes(barber?.id);
  let availableTabs = tabs;
  if (!barber?.is_admin) {
    availableTabs = availableTabs.filter(t => t.id !== 'podesavanja');
  }
  if (!canViewAllTerms) {
    availableTabs = availableTabs.filter(t => t.id !== 'svi-termini');
  }

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
        
        {/* ALL APPOINTMENTS TAB - for Crni, Kole, Anđelo */}
        {activeTab === 'svi-termini' && canSeeAllAppointments.includes(barber?.id) && (
          <div className="space-y-6">
            <section>
              <h2 className="text-white/40 text-xs tracking-wider mb-3">IZABERI DATUM</h2>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {days.map((day, i) => {
                  const isSelected = formatDate(day) === formatDate(allAppointmentsDate);
                  const isToday = formatDate(day) === formatDate(new Date());
                  const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
                  return (
                    <button
                      key={i}
                      onClick={() => !isPast && setAllAppointmentsDate(day)}
                      disabled={isPast}
                      className={`flex-shrink-0 w-14 py-2 rounded-lg text-center transition-all
                        ${isSelected ? 'bg-white text-black' : 'bg-white/5 text-white'}
                        ${isToday && !isSelected ? 'ring-1 ring-white/30' : ''}
                        ${isPast ? 'opacity-30 cursor-not-allowed' : ''}`}
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
              <h2 className="text-white/40 text-xs tracking-wider mb-3">FILTRIRAJ PO LOKALU</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedBarberFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm ${selectedBarberFilter === 'all' ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
                >
                  Svi
                </button>
                {locations.map(loc => (
                  <button
                    key={loc.id}
                    onClick={() => setSelectedBarberFilter(loc.id)}
                    className={`px-4 py-2 rounded-lg text-sm ${selectedBarberFilter === loc.id ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
                  >
                    {loc.name.includes('Petra') ? 'Lokal I' : 'Lokal II'}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-white/40 text-xs tracking-wider mb-3">
                TERMINI SVIH BERBERA - {new Date(allAppointmentsDate).toLocaleDateString('sr-RS')}
              </h2>
              
              <div className="space-y-6">
                {allBarbers
                  .filter(b => selectedBarberFilter === 'all' || b.location_id === selectedBarberFilter)
                  .map(targetBarber => {
                    const barberData = allBarberSlots[targetBarber.id] || { available: [], booked: [], duration: 30 };
                    const barberTimeSlots = generateTimeSlots(targetBarber.locations?.name, barberData.duration);
                    const barberLocation = locations.find(l => l.id === targetBarber.location_id);
                    
                    return (
                      <div key={targetBarber.id} className="bg-white/5 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-medium">{targetBarber.name}</h3>
                            <p className="text-white/40 text-xs">
                              {barberLocation?.name?.includes('Petra') ? 'Lokal I - Bulevar kralja Petra' : 'Lokal II - Bulevar patrijarha Pavla'}
                            </p>
                          </div>
                          <div className="text-right text-xs text-white/40">
                            <p>Trajanje: {barberData.duration} min</p>
                            <p>Slobodno: {barberData.available.length} | Zakazano: {barberData.booked.length}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-6 sm:grid-cols-8 gap-1">
                          {barberTimeSlots.map(time => {
                            const isAvailable = barberData.available.includes(time);
                            const isBooked = barberData.booked.includes(time);
                            
                            // Find appointment for this slot
                            const slotAppointment = allAppointmentsData.find(a => 
                              a.barber_id === targetBarber.id &&
                              a.appointment_time?.slice(0, 5) === time
                            );
                            
                            const isPast = slotAppointment && (() => {
                              const aptDate = new Date(allAppointmentsDate);
                              const [hours, minutes] = time.split(':').map(Number);
                              aptDate.setHours(hours, minutes, 0, 0);
                              const endTime = new Date(aptDate.getTime() + (slotAppointment.duration_minutes || 30) * 60 * 1000);
                              return new Date() > endTime;
                            })();
                            
                            const isNoShow = slotAppointment?.no_show;
                            const isBirthday = slotAppointment?.customer_birthday && (() => {
                              const birthday = new Date(slotAppointment.customer_birthday);
                              const aptDate = new Date(allAppointmentsDate);
                              return birthday.getDate() === aptDate.getDate() && 
                                     birthday.getMonth() === aptDate.getMonth();
                            })();
                            const isBlacklisted = slotAppointment?.customer_phone && 
                              blacklist.some(b => b.customer_phone === slotAppointment.customer_phone);
                            
                            let bgColor = 'bg-white/5 text-white/40';
                            let useGradient = false;
                            if (isAvailable && !isBooked) bgColor = 'bg-white text-black';
                            if (isBooked && !isPast && !isNoShow && !isBirthday && !isBlacklisted) bgColor = 'bg-green-600 text-white';
                            if (isBooked && !isPast && !isNoShow && isBirthday && !isBlacklisted) bgColor = 'bg-blue-500 text-white';
                            if (isBooked && !isPast && !isNoShow && isBlacklisted) useGradient = true;
                            if (isBooked && isPast && !isNoShow) bgColor = 'bg-orange-500 text-white';
                            if (isNoShow) bgColor = 'bg-red-600 text-white';
                            
                            return (
                              <button
                                key={time}
                                onClick={() => {
                                  if (isBooked && slotAppointment) {
                                    setSelectedAppointment(slotAppointment);
                                  } else if (isAvailable) {
                                    setSelectedBarberForBooking(targetBarber);
                                    setAllViewManualBookingSlot(time);
                                    setShowAllViewManualBooking(true);
                                  }
                                }}
                                className={`py-2 rounded text-xs font-medium transition-all
                                  ${useGradient ? 'text-white' : bgColor}`}
                                style={useGradient ? {
                                  background: 'linear-gradient(135deg, #16a34a 50%, #dc2626 50%)'
                                } : {}}
                              >
                                {time}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
              
              <div className="flex gap-3 mt-4 justify-center text-xs flex-wrap">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-white/10 rounded border border-white/20"></span> Nedostupan</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-white rounded"></span> Slobodan</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-600 rounded"></span> Zakazan</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded"></span> Rođendan</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{background: 'linear-gradient(135deg, #16a34a 50%, #dc2626 50%)'}}></span> Crna lista</span>
              </div>
            </section>
          </div>
        )}

        {/* Manual Booking Modal for All View */}
        {showAllViewManualBooking && selectedBarberForBooking && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-4 border-b border-zinc-700 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium">Zakaži termin</h3>
                  <p className="text-white/40 text-sm">{selectedBarberForBooking.name} - {formatDate(allAppointmentsDate)} u {allViewManualBookingSlot}</p>
                </div>
                <button onClick={() => {
                  setShowAllViewManualBooking(false);
                  setSelectedBarberForBooking(null);
                  setAllViewManualBookingSlot(null);
                }} className="text-white/40 text-2xl">&times;</button>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target;
                const serviceSelect = form.service;
                const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
                
                const success = await bookSlotForBarber(selectedBarberForBooking, allViewManualBookingSlot, {
                  name: form.name.value,
                  phone: form.phone.value,
                  service_id: form.service.value,
                  service_name: selectedOption.dataset.name,
                  service_price: parseInt(selectedOption.dataset.price) || 0,
                  duration: parseInt(selectedOption.dataset.duration) || 30
                });
                
                if (success) {
                  setShowAllViewManualBooking(false);
                  setSelectedBarberForBooking(null);
                  setAllViewManualBookingSlot(null);
                }
              }} className="p-4 space-y-4">
                <div>
                  <label className="text-white/40 text-xs block mb-1">IME KLIJENTA *</label>
                  <input name="name" required className="w-full bg-black border border-zinc-700 rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-white/40 text-xs block mb-1">TELEFON *</label>
                  <input name="phone" required className="w-full bg-black border border-zinc-700 rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-white/40 text-xs block mb-1">USLUGA *</label>
                  <select name="service" required className="w-full bg-black border border-zinc-700 rounded px-3 py-2">
                    <option value="">Izaberi uslugu</option>
                    {services.filter(s => !s.is_additional).map(s => (
                      <option key={s.id} value={s.id} data-name={s.name} data-price={s.price} data-duration={s.duration_minutes}>
                        {s.name} - {s.price ? `${s.price} RSD` : 'Po dogovoru'}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="w-full py-3 bg-white text-black rounded-lg font-medium">
                  ZAKAŽI
                </button>
              </form>
            </div>
          </div>
        )}
        
        {activeTab === 'termini' && (
          <div className="space-y-6">
            <section>
              <h2 className="text-white/40 text-xs tracking-wider mb-3">IZABERI DATUM</h2>
              <div ref={datePickerRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {days.map((day, i) => {
                  const isSelected = formatDate(day) === formatDate(selectedDate);
                  const isToday = formatDate(day) === formatDate(new Date());
                  const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
                  return (
                    <button
                      key={i}
                      onClick={() => !isPast && setSelectedDate(day)}
                      disabled={isPast}
                      className={`flex-shrink-0 w-14 py-2 rounded-lg text-center transition-all
                        ${isSelected ? 'bg-white text-black' : 'bg-white/5 text-white'}
                        ${isToday && !isSelected ? 'ring-1 ring-white/30' : ''}
                        ${isPast ? 'opacity-30 cursor-not-allowed' : ''}`}
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
                  
                  // Find appointment for this slot
                  const slotAppointment = appointments.find(a => 
                    a.appointment_date === formatDate(selectedDate) && 
                    a.appointment_time?.slice(0, 5) === time &&
                    a.status !== 'cancelled'
                  );
                  
                  // Check if appointment is past (ended)
                  const isPast = slotAppointment && (() => {
                    const aptDate = new Date(slotAppointment.appointment_date);
                    const [hours, minutes] = time.split(':').map(Number);
                    aptDate.setHours(hours, minutes, 0, 0);
                    const endTime = new Date(aptDate.getTime() + (slotAppointment.duration_minutes || 30) * 60 * 1000);
                    return new Date() > endTime;
                  })();
                  
                  const isNoShow = slotAppointment?.no_show;
                  
                  // Check if it's customer's birthday
                  const isBirthday = slotAppointment?.customer_birthday && (() => {
                    const birthday = new Date(slotAppointment.customer_birthday);
                    const aptDate = new Date(slotAppointment.appointment_date);
                    return birthday.getDate() === aptDate.getDate() && 
                           birthday.getMonth() === aptDate.getMonth();
                  })();
                  
                  // Check if customer is blacklisted
                  const isBlacklisted = slotAppointment?.customer_phone && 
                    blacklist.some(b => b.customer_phone === slotAppointment.customer_phone);
                  
                  // Determine background color/style
                  let bgColor = 'bg-white/5 text-white/40'; // default - not available (gray)
                  let useGradient = false;
                  if (isAvailable && !isBooked) bgColor = 'bg-white text-black'; // available (white)
                  if (isBooked && !isPast && !isNoShow && !isBirthday && !isBlacklisted) bgColor = 'bg-green-600 text-white'; // booked (green)
                  if (isBooked && !isPast && !isNoShow && isBirthday && !isBlacklisted) bgColor = 'bg-blue-500 text-white'; // birthday (blue)
                  if (isBooked && !isPast && !isNoShow && isBlacklisted) {
                    useGradient = true; // blacklisted - half green, half red
                  }
                  if (isBooked && isPast && !isNoShow) bgColor = 'bg-orange-500 text-white'; // past (orange)
                  if (isNoShow) bgColor = 'bg-red-600 text-white'; // no-show (red)
                  
                  return (
                    <button
                      key={time}
                      onClick={async () => {
                        // BOOKED SLOT - show details or blocked slot options
                        if (isBooked) {
                          let apt = slotAppointment;
                          
                          if (!apt) {
                            const { data } = await supabase
                              .from('appointments')
                              .select('*')
                              .eq('barber_id', barber.id)
                              .eq('appointment_date', formatDate(selectedDate))
                              .eq('appointment_time', time + ':00')
                              .neq('status', 'cancelled')
                              .single();
                            apt = data;
                          }
                          
                          if (apt) {
                            setSelectedAppointment(apt);
                          } else {
                            setBlockedSlotTime(time);
                          }
                          return;
                        }
                        
                        // NOT BOOKED SLOTS
                        if (slotsLocked) {
                          // Locked mode: click on available slot opens booking form
                          if (isAvailable) {
                            setManualBookingSlot(time);
                            setShowManualBooking(true);
                          }
                        } else {
                          // Edit mode - toggle availability
                          if (isAvailable) {
                            // WHITE slot clicked -> make it unavailable (gray)
                            toggleSlot(time);
                          } else {
                            // GRAY slot clicked -> make it available (white)
                            toggleSlot(time);
                          }
                        }
                      }}
                      disabled={saving || (slotsLocked && !isAvailable && !isBooked)}
                      className={`py-3 rounded text-sm font-medium transition-all
                        ${useGradient ? 'text-white' : bgColor}
                        ${saving ? 'opacity-50' : ''}
                        ${isBooked ? 'cursor-pointer' : ''}`}
                      style={useGradient ? {
                        background: 'linear-gradient(135deg, #16a34a 50%, #dc2626 50%)'
                      } : {}}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
              
              <div className="flex gap-3 mt-3 justify-center text-xs flex-wrap">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-white/10 rounded border border-white/20"></span> Nedostupan</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-white rounded"></span> Slobodan</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-600 rounded"></span> Zakazan</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded"></span> Rođendan</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{background: 'linear-gradient(135deg, #16a34a 50%, #dc2626 50%)'}}></span> Crna lista</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-500 rounded"></span> Prošao</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-600 rounded"></span> Nije došao</span>
              </div>
              
              <p className="text-white/40 text-xs mt-3 text-center">
                {slotsLocked 
                  ? '✓ Termini zaključani • Klikni na slobodan za zakazivanje • Klikni na zakazan za detalje'
                  : 'Klikni na siv/beo da menjaš dostupnost • Zaključaj termine pa klikni na beo za zakazivanje'
                }
              </p>
            </section>

            <button
              onClick={toggleSlotsLocked}
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
                      {/* Image upload for new barber */}
                      <div className="flex flex-col items-center mb-4">
                        {newBarberImagePreview ? (
                          <img 
                            src={newBarberImagePreview} 
                            alt="Preview" 
                            className="w-32 h-32 rounded-full object-cover mb-4 border-2 border-white/20"
                          />
                        ) : (
                          <div className="w-32 h-32 rounded-full bg-white/10 flex items-center justify-center text-white/30 text-5xl mb-4 border-2 border-white/20">
                            👤
                          </div>
                        )}
                        <input
                          ref={newBarberFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setNewBarberImage(file);
                              setNewBarberImagePreview(URL.createObjectURL(file));
                            }
                          }}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => newBarberFileInputRef.current?.click()}
                          className="text-sm text-white/50 border border-white/20 px-4 py-2 rounded"
                        >
                          {newBarberImagePreview ? 'PROMENI SLIKU' : 'DODAJ SLIKU'}
                        </button>
                      </div>
                      
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
                      <div>
                        <label className="block text-white/40 text-xs mb-2">EMAIL ZA LOGIN</label>
                        <input
                          type="email"
                          value={newBarberEmail}
                          onChange={(e) => setNewBarberEmail(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white"
                          placeholder="email@primer.com"
                        />
                      </div>
                      <div>
                        <label className="block text-white/40 text-xs mb-2">LOZINKA ZA LOGIN</label>
                        <input
                          type="password"
                          value={newBarberPassword}
                          onChange={(e) => setNewBarberPassword(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white"
                          placeholder="Minimum 6 karaktera"
                        />
                      </div>
                      <button
                        onClick={addBarber}
                        disabled={!newBarberName || !newBarberLocation || !newBarberEmail || !newBarberPassword || savingAuth}
                        className="w-full bg-white text-black py-3 rounded-lg font-medium disabled:opacity-50"
                      >
                        {savingAuth ? 'KREIRANJE...' : 'SACUVAJ'}
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

                    {/* Login credentials section */}
                    <div className="mb-6 p-4 bg-white/5 rounded-lg">
                      <h3 className="text-white/40 text-xs tracking-wider mb-4">LOGIN PODACI</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-white/40 text-xs mb-1">NOVI EMAIL</label>
                          <input
                            type="email"
                            value={editingBarberEmail}
                            onChange={(e) => setEditingBarberEmail(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
                            placeholder="Ostavi prazno ako ne menjaš"
                          />
                        </div>
                        <div>
                          <label className="block text-white/40 text-xs mb-1">NOVA LOZINKA</label>
                          <input
                            type="password"
                            value={editingBarberPassword}
                            onChange={(e) => setEditingBarberPassword(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
                            placeholder="Ostavi prazno ako ne menjaš"
                          />
                        </div>
                        <button
                          onClick={updateBarberAuth}
                          disabled={(!editingBarberEmail && !editingBarberPassword) || savingAuth}
                          className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                        >
                          {savingAuth ? 'ČUVANJE...' : 'AŽURIRAJ LOGIN'}
                        </button>
                      </div>
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
                    const isNoShow = apt.no_show;
                    
                    return (
                      <div 
                        key={apt.id} 
                        className={`rounded-lg p-3 ${
                          isNoShow ? 'bg-red-500/20 border border-red-500/30' :
                          isPast ? 'bg-white/5 opacity-60' : 'bg-white/10'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className={`font-medium text-sm ${isNoShow ? 'text-red-400' : ''}`}>{apt.customer_name}</p>
                            <p className="text-white/50 text-xs">{apt.service_name}</p>
                            <p className="text-white/30 text-xs mt-1">
                              {new Date(apt.appointment_date).toLocaleDateString('sr-RS')} • {apt.appointment_time?.slice(0, 5)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`font-medium text-sm ${isNoShow ? 'line-through text-red-400/50' : ''}`}>
                              {apt.service_price?.toLocaleString()} RSD
                            </p>
                            {isNoShow ? (
                              <span className="text-red-400 text-xs">❌ Nije došao</span>
                            ) : isPast ? (
                              <span className="text-green-400 text-xs">✓ Završeno</span>
                            ) : null}
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
                  {pastAppointments.filter(a => !a.no_show).reduce((sum, a) => sum + (a.service_price || 0), 0).toLocaleString()} RSD
                </span>
                {pastAppointments.some(a => a.no_show) && (
                  <span className="text-red-400 ml-2">
                    ({pastAppointments.filter(a => a.no_show).length} nije došao)
                  </span>
                )}
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
              <div>
                <label className="block text-white/50 text-xs mb-1">Usluga</label>
                <select
                  value={manualBookingForm.serviceId}
                  onChange={(e) => setManualBookingForm(prev => ({ ...prev, serviceId: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white appearance-none"
                >
                  <option value="" className="bg-zinc-900">-- Izaberi uslugu --</option>
                  {allServices.filter(s => !s.is_additional).map(service => (
                    <option key={service.id} value={service.id} className="bg-zinc-900">
                      {service.name} - {service.price?.toLocaleString() || 0} RSD
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-white/50 text-xs mb-1">Dodatna usluga (opciono)</label>
                <select
                  value={manualBookingForm.additionalServiceId}
                  onChange={(e) => setManualBookingForm(prev => ({ ...prev, additionalServiceId: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white appearance-none"
                >
                  <option value="" className="bg-zinc-900">-- Bez dodatne usluge --</option>
                  {allServices.filter(s => s.is_additional).map(service => (
                    <option key={service.id} value={service.id} className="bg-zinc-900">
                      {service.name} - {service.price?.toLocaleString() || 0} RSD
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Show selected price summary */}
              {(manualBookingForm.serviceId || manualBookingForm.additionalServiceId) && (
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-white/50 text-xs">UKUPNA CENA</p>
                  <p className="text-lg font-medium">
                    {(() => {
                      const main = allServices.find(s => s.id === manualBookingForm.serviceId);
                      const add = allServices.find(s => s.id === manualBookingForm.additionalServiceId);
                      const total = (main?.price || 0) + (add?.price || 0);
                      return total.toLocaleString() + ' RSD';
                    })()}
                  </p>
                </div>
              )}
              
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowManualBooking(false);
                    setManualBookingForm({ name: '', phone: '', serviceId: '', additionalServiceId: '' });
                  }}
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

            {/* Appointment Detail Modal */}
      {selectedAppointment && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedAppointment(null)}
        >
          <div 
            className="bg-zinc-900 rounded-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-700 flex justify-between items-center">
              <h3 className="font-medium text-lg">Detalji rezervacije</h3>
              <button 
                onClick={() => setSelectedAppointment(null)}
                className="text-white/50 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-white/40 text-xs">KLIJENT</p>
                <p className="text-lg font-medium">{selectedAppointment.customer_name}</p>
              </div>
              
              {/* Birthday notice */}
              {selectedAppointment.customer_birthday && (() => {
                const birthday = new Date(selectedAppointment.customer_birthday);
                const aptDate = new Date(selectedAppointment.appointment_date);
                const isBirthday = birthday.getDate() === aptDate.getDate() && 
                                   birthday.getMonth() === aptDate.getMonth();
                return isBirthday ? (
                  <div className="bg-blue-500/20 text-blue-400 p-3 rounded-lg text-center font-medium">
                    🎂 Danas je klijentu rođendan!
                  </div>
                ) : null;
              })()}
              
              {/* Blacklist warning */}
              {selectedAppointment.customer_phone && (() => {
                const blacklistEntry = blacklist.find(b => b.customer_phone === selectedAppointment.customer_phone);
                return blacklistEntry ? (
                  <div className="bg-red-500/20 text-red-400 p-3 rounded-lg">
                    <p className="font-medium text-center mb-2">⚠️ KLIJENT NA CRNOJ LISTI</p>
                    <p className="text-sm">Propustio termin: {blacklistEntry.missed_date ? new Date(blacklistEntry.missed_date).toLocaleDateString('sr-RS') : 'N/A'}</p>
                    <p className="text-sm">Usluga: {blacklistEntry.missed_service_name || 'N/A'}</p>
                    <p className="text-sm font-medium">Duguje: {blacklistEntry.missed_service_price?.toLocaleString() || 0} RSD</p>
                  </div>
                ) : null;
              })()}
              
              {selectedAppointment.customer_phone && (
                <div>
                  <p className="text-white/40 text-xs">TELEFON</p>
                  <a href={`tel:${selectedAppointment.customer_phone}`} className="text-lg text-blue-400">
                    {selectedAppointment.customer_phone}
                  </a>
                </div>
              )}
              
              {selectedAppointment.customer_email && (
                <div>
                  <p className="text-white/40 text-xs">EMAIL</p>
                  <p className="text-white/70">{selectedAppointment.customer_email}</p>
                </div>
              )}
              
              <div>
                <p className="text-white/40 text-xs">USLUGA</p>
                <p className="text-lg">{selectedAppointment.service_name}</p>
              </div>
              
              <div className="flex gap-4">
                <div>
                  <p className="text-white/40 text-xs">DATUM</p>
                  <p className="text-lg">{new Date(selectedAppointment.appointment_date).toLocaleDateString('sr-RS')}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">VREME</p>
                  <p className="text-lg">{selectedAppointment.appointment_time?.slice(0, 5)}</p>
                </div>
              </div>
              
              <div>
                <p className="text-white/40 text-xs">CENA</p>
                <p className="text-lg font-medium">{selectedAppointment.service_price?.toLocaleString() || 0} RSD</p>
              </div>
              
              {selectedAppointment.no_show && (
                <div className="bg-red-500/20 text-red-400 p-3 rounded-lg text-center font-medium">
                  ❌ Klijent se nije pojavio
                </div>
              )}
              
              {/* Show Cancel button only for future appointments */}
              {!selectedAppointment.no_show && (() => {
                const aptDate = new Date(selectedAppointment.appointment_date);
                const [hours, minutes] = (selectedAppointment.appointment_time || '00:00').split(':').map(Number);
                aptDate.setHours(hours, minutes, 0, 0);
                return new Date() < aptDate; // Before appointment starts
              })() && (
                <button
                  onClick={() => cancelAppointmentAdmin(selectedAppointment)}
                  className="w-full py-3 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition"
                >
                  OTKAŽI TERMIN
                </button>
              )}
              
              {/* Show No-Show button only for past or current appointments that aren't already marked */}
              {!selectedAppointment.no_show && (() => {
                const aptDate = new Date(selectedAppointment.appointment_date);
                const [hours, minutes] = (selectedAppointment.appointment_time || '00:00').split(':').map(Number);
                aptDate.setHours(hours, minutes, 0, 0);
                return new Date() >= aptDate;
              })() && (
                <button
                  onClick={() => markNoShow(selectedAppointment.id, selectedAppointment)}
                  className="w-full py-3 rounded-lg bg-red-500/20 text-red-400 font-medium hover:bg-red-500/30 transition"
                >
                  NIJE SE POJAVIO
                </button>
              )}
            </div>
            <div className="p-4 border-t border-zinc-700">
              <button
                onClick={() => setSelectedAppointment(null)}
                className="w-full py-3 rounded-lg bg-white/10 text-white"
              >
                Zatvori
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blocked Slot Modal - for slots marked as booked but without appointment data */}
      {blockedSlotTime && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setBlockedSlotTime(null)}
        >
          <div 
            className="bg-zinc-900 rounded-xl w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-700">
              <h3 className="font-medium text-lg text-center">Blokiran termin</h3>
              <p className="text-white/50 text-sm text-center mt-1">
                {formatDate(selectedDate)} u {blockedSlotTime}
              </p>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-white/60 text-sm text-center">
                Ovaj termin je označen kao zauzet, ali nema podatke o rezervaciji.
              </p>
              <button
                onClick={() => {
                  setManualBookingSlot(blockedSlotTime);
                  setShowManualBooking(true);
                  setBlockedSlotTime(null);
                }}
                className="w-full py-3 rounded-lg bg-green-600 text-white font-medium"
              >
                DODAJ REZERVACIJU
              </button>
              <button
                onClick={async () => {
                  // Unblock the slot
                  await supabase
                    .from('barber_available_slots')
                    .update({ is_booked: false })
                    .eq('barber_id', barber.id)
                    .eq('slot_date', formatDate(selectedDate))
                    .eq('slot_time', blockedSlotTime + ':00');
                  
                  setBlockedSlotTime(null);
                  loadSlotsForDate();
                }}
                className="w-full py-3 rounded-lg bg-white/10 text-white font-medium"
              >
                OSLOBODI TERMIN
              </button>
              <button
                onClick={() => setBlockedSlotTime(null)}
                className="w-full py-2 text-white/50 text-sm"
              >
                Zatvori
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
