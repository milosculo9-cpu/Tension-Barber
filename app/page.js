'use client'

import { useState, useEffect } from 'react'
import { supabase, STORAGE_URL, getLogoUrl, getBarberImageUrl, getBackgroundImageUrl } from '@/lib/supabase'

// Desktop hero images
const DESKTOP_HERO_IMAGES = [
  'IMG_8161.jpeg',
  'IMG_4953.jpeg',
  'IMG_3.jpeg',
  'IMG_4951.jpeg',
  'IMG_8168.jpeg',
  'IMG_4958.jpeg',
  'IMG_8166.jpeg',
  'IMG_4955.jpeg',
  'IMG_8169.jpeg',
]

// Mobile hero images (in mobile subfolder)
const MOBILE_HERO_IMAGES = [
  'mobile/1.jpeg',
  'mobile/2.jpeg',
  'mobile/3.jpeg',
  'mobile/4.jpeg',
  'mobile/5.jpeg',
  'mobile/6.jpeg',
]

const SERVICES = [
  { id: 1, name: 'Šišanje "Fejd"', price: 1200 },
  { id: 2, name: 'Šišanje duža kosa', price: 1500 },
  { id: 3, name: 'Šišanje zatvorski', price: 800 },
  { id: 4, name: 'Brijanje glave britvom', price: 800 },
  { id: 5, name: 'Trimovanje i konture brade', price: 600 },
  { id: 6, name: 'Konture brade', price: 350 },
  { id: 7, name: 'Oblikovanje obrva koncem', price: 400 },
  { id: 8, name: 'Oblikovanje obrva britvom', price: 300 },
  { id: 9, name: 'Pranje kose', price: 350 },
  { id: 10, name: 'Vosak uši', price: 300 },
  { id: 11, name: 'Vosak nos', price: 300 },
  { id: 12, name: 'Farbanje kose', price: null },
  { id: 13, name: 'Farbanje brade', price: null },
  { id: 14, name: 'Tension Full Paket', price: 3000 },
  { id: 15, name: '"Vanredno" šišanje', price: 1500 },
  { id: 16, name: 'Tension All Inclusive', price: 3500 },
]

// Additional services that can be added to haircut
const ADDON_SERVICES = [
  { id: 101, name: 'Oblikovanje obrva britvom', price: 300 },
  { id: 102, name: 'Vosak nos', price: 300 },
  { id: 103, name: 'Vosak uši', price: 300 },
  { id: 104, name: 'Pranje kose', price: 350 },
  { id: 105, name: 'Konture brade', price: 350 },
  { id: 106, name: 'Oblikovanje obrva koncem', price: 400 },
  { id: 107, name: 'Trimovanje i konture brade', price: 600 },
]

// Services that trigger addon selection (contain "šišanje" or are haircut packages)
const SISANJE_SERVICE_IDS = [1, 2, 3, 15] // Fejd, Duža kosa, Zatvorski, Vanredno

// Services that REQUIRE double slot (Tension packages)
const DOUBLE_SLOT_SERVICE_IDS = [14, 16] // Tension Full Paket, Tension All Inclusive

// Generate dates for next 2 weeks
function generateDates() {
  const dates = []
  const days = ['Ned', 'Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub']
  const today = new Date()
  
  for (let i = 0; i < 14; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    dates.push({
      date: date,
      day: days[date.getDay()],
      dayNum: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      formatted: `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`,
      iso: date.toISOString().split('T')[0]
    })
  }
  return dates
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(true)
  const [preloaderFading, setPreloaderFading] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [selectedSalon, setSelectedSalon] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedBarber, setSelectedBarber] = useState(null)
  const [selectedTime, setSelectedTime] = useState(null)
  const [selectedService, setSelectedService] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({ email: '', name: '', phone: '', birthDay: '', birthMonth: '', birthYear: '' })
  const [showNavbar, setShowNavbar] = useState(true)
  const [confirmedBooking, setConfirmedBooking] = useState(null)
  const [openDropdown, setOpenDropdown] = useState(null)
  const [bookingAnimation, setBookingAnimation] = useState(null) // 'logo' | 'fade' | 'confirm' | null
  const [selectedAddons, setSelectedAddons] = useState([])
  const [isMobile, setIsMobile] = useState(false)
  const [showNoNextSlotWarning, setShowNoNextSlotWarning] = useState(false)
  
  // Dynamic data from database
  const [salons, setSalons] = useState([])
  const [availableSlots, setAvailableSlots] = useState({})
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [priceList, setPriceList] = useState([])
  
  const dates = generateDates()
  
  // Get current hero images based on device type
  const HERO_IMAGES = isMobile ? MOBILE_HERO_IMAGES : DESKTOP_HERO_IMAGES

  // Load price list from database
  useEffect(() => {
    const loadPriceList = async () => {
      const { data } = await supabase
        .from('services')
        .select('*')
        .order('display_order')
      if (data) setPriceList(data.map(s => ({ ...s, price: s.price ? parseFloat(s.price) : null })))
    }
    loadPriceList()

    // Realtime subscription for price list changes
    const channel = supabase
      .channel('services-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, () => {
        loadPriceList()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  // Detect mobile device
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)')
    setIsMobile(mediaQuery.matches)
    
    const handler = (e) => {
      setIsMobile(e.matches)
      setCurrentSlide(0) // Reset slide when switching device type
    }
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Load salons and barbers from database on mount
  useEffect(() => {
    loadSalonsAndBarbers()
  }, [])

  const loadSalonsAndBarbers = async () => {
    // Load locations
    const { data: locations } = await supabase
      .from('locations')
      .select('*')
      .order('name')

    // Load barbers with their locations
    const { data: barbers } = await supabase
      .from('barbers')
      .select('*')
      .order('name')

    if (locations && barbers) {
      // Sort locations so Petra (Lokal 1) comes first
      const sortedLocations = [...locations].sort((a, b) => {
        const aIsPetra = a.name.includes('Petra')
        const bIsPetra = b.name.includes('Petra')
        if (aIsPetra && !bIsPetra) return -1
        if (!aIsPetra && bIsPetra) return 1
        return 0
      })

      const salonsData = sortedLocations.map(loc => {
        const isLoc1 = loc.name.includes('Petra')
        const locationBarbers = barbers
          .filter(b => b.location_id === loc.id)
          .map(b => ({
            id: b.id,
            name: b.name,
            slug: b.name.toLowerCase()
              .replace(/đ/g, 'dj')
              .replace(/č/g, 'c')
              .replace(/ć/g, 'c')
              .replace(/š/g, 's')
              .replace(/ž/g, 'z')
              .replace(/[^a-z]/g, ''),
            image_url: b.image_url
          }))

        return {
          id: loc.id,
          name: isLoc1 ? 'Tension Barber I' : 'Tension Barber II',
          address: isLoc1 ? 'Bulevar kralja Petra I 85' : 'Bulevar patrijarha Pavla 117',
          fullName: loc.name,
          slug: isLoc1 ? 'bulevar-kralja-petra' : 'bulevar-patrijarha-pavla',
          image: isLoc1 ? 'shop.jpeg' : 'shop2.jpeg',
          barbers: locationBarbers
        }
      })

      setSalons(salonsData)
    }
  }

  // Load available slots when date or salon changes
  useEffect(() => {
    if (selectedDate && selectedSalon) {
      loadAvailableSlots()
    }
  }, [selectedDate, selectedSalon])

  const loadAvailableSlots = async () => {
    if (!selectedDate || !selectedSalon) return
    
    setLoadingSlots(true)
    
    const barberIds = selectedSalon.barbers.map(b => b.id)
    
    const { data: slots } = await supabase
      .from('barber_available_slots')
      .select('*')
      .in('barber_id', barberIds)
      .eq('slot_date', selectedDate.iso)
      .eq('is_booked', false)
      .order('slot_time')
    
    const slotsByBarber = {}
    if (slots) {
      slots.forEach(slot => {
        if (!slotsByBarber[slot.barber_id]) {
          slotsByBarber[slot.barber_id] = []
        }
        slotsByBarber[slot.barber_id].push(slot.slot_time.slice(0, 5))
      })
    }
    
    setAvailableSlots(slotsByBarber)
    setLoadingSlots(false)
  }

  // Real-time subscription for slot changes
  useEffect(() => {
    if (!selectedDate || !selectedSalon) return

    const channel = supabase
      .channel('slots-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'barber_available_slots',
          filter: `slot_date=eq.${selectedDate.iso}`
        },
        () => {
          loadAvailableSlots()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedDate, selectedSalon])

  // Preload critical images
  useEffect(() => {
    // Scroll to top on page load
    window.scrollTo(0, 0)
    
    const hidePreloader = () => {
      setPreloaderFading(true)
      setTimeout(() => {
        setIsLoading(false)
      }, 1000)
    }

    const timer = setTimeout(hidePreloader, 2500)
    return () => clearTimeout(timer)
  }, [])

  // Load saved customer data from localStorage on mount
  useEffect(() => {
    const savedCustomer = localStorage.getItem('tensionBarberCustomer')
    if (savedCustomer) {
      try {
        const customerData = JSON.parse(savedCustomer)
        setForm(customerData)
      } catch (e) {
        console.error('Error loading saved customer data:', e)
      }
    }
  }, [])

  // Auto-slide every 3 seconds
  useEffect(() => {
    const imageCount = isMobile ? MOBILE_HERO_IMAGES.length : DESKTOP_HERO_IMAGES.length
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % imageCount)
    }, 3000)
    return () => clearInterval(timer)
  }, [isMobile])

  // Show navbar only when at very top of page
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      if (currentScrollY < 10) {
        setShowNavbar(true)
      } else {
        setShowNavbar(false)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll to section
  const scrollToSection = (id) => {
    setTimeout(() => {
      const element = document.getElementById(id)
      if (element) {
        const offset = 20
        const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
        window.scrollTo({
          top: elementPosition - offset,
          behavior: 'smooth'
        })
      }
    }, 150)
  }

  // Helper function to get next time slot based on barber's slot duration
  const getNextTimeSlot = async (barberId, date, currentTime) => {
    // Get barber's slot duration for this date
    const { data: settings } = await supabase
      .from('barber_slot_settings')
      .select('slot_duration')
      .eq('barber_id', barberId)
      .eq('slot_date', date)
      .single()
    
    const duration = settings?.slot_duration || 30
    const [hours, minutes] = currentTime.split(':').map(Number)
    let totalMinutes = hours * 60 + minutes + duration
    
    const nextHours = Math.floor(totalMinutes / 60)
    const nextMinutes = totalMinutes % 60
    
    return `${nextHours.toString().padStart(2, '0')}:${nextMinutes.toString().padStart(2, '0')}`
  }

  // Handle booking submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!selectedService) {
      alert('Molimo izaberite uslugu.')
      return
    }
    
    setIsSubmitting(true)

    // Calculate total service name and price including addons
    const addonNames = selectedAddons.map(a => a.name).join(', ')
    const addonTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0)
    const fullServiceName = addonNames 
      ? `${selectedService.name} + ${addonNames}`
      : selectedService.name
    const fullServicePrice = (selectedService.price || 0) + addonTotal
    
    // Only Tension Full Paket and Tension All Inclusive need double slot
    const needsDoubleSlot = DOUBLE_SLOT_SERVICE_IDS.includes(selectedService.id)

    try {
      // If this service needs double slot, check if next slot is available
      if (needsDoubleSlot) {
        const nextSlotTime = await getNextTimeSlot(selectedBarber.id, selectedDate.iso, selectedTime)
        
        const { data: nextSlot } = await supabase
          .from('barber_available_slots')
          .select('*')
          .eq('barber_id', selectedBarber.id)
          .eq('slot_date', selectedDate.iso)
          .eq('slot_time', nextSlotTime + ':00')
          .eq('is_booked', false)
          .single()
        
        if (!nextSlot) {
          // No next slot available - show warning and don't create reservation
          setIsSubmitting(false)
          setShowNoNextSlotWarning(true)
          return
        }
        
        // Book the next slot too
        await supabase
          .from('barber_available_slots')
          .update({ is_booked: true })
          .eq('barber_id', selectedBarber.id)
          .eq('slot_date', selectedDate.iso)
          .eq('slot_time', nextSlotTime + ':00')
      }

      const { data: appointmentData, error } = await supabase
        .from('appointments')
        .insert([
          {
            barber_id: selectedBarber.id,
            service_name: fullServiceName,
            service_price: fullServicePrice,
            customer_name: form.name,
            customer_email: form.email,
            customer_phone: form.phone,
            customer_birthday: (form.birthYear && form.birthMonth && form.birthDay) 
              ? `${form.birthYear}-${form.birthMonth}-${form.birthDay}` 
              : null,
            appointment_date: selectedDate.iso,
            appointment_time: selectedTime + ':00',
            duration_minutes: needsDoubleSlot ? 60 : 30,
            status: 'confirmed'
          }
        ])
        .select('cancellation_token')
        .single()

      if (error) throw error

      // Mark the main slot as booked
      await supabase
        .from('barber_available_slots')
        .update({ is_booked: true })
        .eq('barber_id', selectedBarber.id)
        .eq('slot_date', selectedDate.iso)
        .eq('slot_time', selectedTime + ':00')

      // Update local state immediately
      setAvailableSlots(prev => ({
        ...prev,
        [selectedBarber.id]: prev[selectedBarber.id]?.filter(t => t !== selectedTime) || []
      }))

      localStorage.setItem('tensionBarberCustomer', JSON.stringify(form))

      // Send confirmation email
      try {
        await fetch('/api/send-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: form.name,
            customerEmail: form.email,
            serviceName: fullServiceName,
            servicePrice: fullServicePrice,
            barberName: selectedBarber.name,
            appointmentDate: selectedDate.iso,
            appointmentTime: selectedTime,
            salonAddress: selectedSalon.address,
            cancellationToken: appointmentData?.cancellation_token
          })
        })
      } catch (emailError) {
        console.error('Email error:', emailError)
      }

      setConfirmedBooking({
        service: { 
          name: fullServiceName, 
          price: fullServicePrice,
          addons: selectedAddons 
        },
        barber: selectedBarber,
        date: selectedDate,
        time: selectedTime
      })

      setShowForm(false)
      setSelectedService(null)
      setSelectedAddons([])
      
      // Animation sequence: logo (1s) -> fade out (0.5s) -> show confirmation
      setBookingAnimation('logo')
      
      setTimeout(() => {
        setBookingAnimation('fade')
      }, 1000)
      
      setTimeout(() => {
        setBookingAnimation(null)
        setShowConfirm(true)
      }, 1500)
      
      setTimeout(() => {
        setShowConfirm(false)
        setConfirmedBooking(null)
        setSelectedSalon(null)
        setSelectedDate(null)
        setSelectedBarber(null)
        setSelectedTime(null)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }, 6500)

    } catch (error) {
      console.error('Booking error:', error)
      alert('Došlo je do greške. Pokušajte ponovo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getTimeSlots = (barberId) => {
    return availableSlots[barberId] || []
  }

  const getBarberImage = (barber) => {
    if (barber.image_url) return barber.image_url
    return getBarberImageUrl(barber.slug)
  }

  return (
    <main className="min-h-screen bg-black text-white">
      
      {/* ==================== PRELOADER ==================== */}
      {isLoading && (
        <div className={`fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center transition-opacity duration-1000 ${preloaderFading ? 'opacity-0' : 'opacity-100'}`}>
          <img 
            src={getLogoUrl('white')} 
            alt="Tension Barber" 
            className="w-60 md:w-72 lg:w-80 animate-pulse-logo mt-1 md:-mt-8"
          />
        </div>
      )}

      {/* ==================== NAVBAR ==================== */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${showNavbar ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="bg-gradient-to-b from-black via-black/80 to-transparent pt-5 pb-12 px-6">
          <h1 className="text-center text-xl md:text-2xl font-light tracking-[0.2em]">TENSION BARBER</h1>
        </div>
      </nav>
      
      {/* ==================== HERO SECTION ==================== */}
      <section className="hero-section">
        {HERO_IMAGES.map((img, i) => (
          <div
            key={i}
            className={`slide ${currentSlide === i ? 'active' : ''}`}
            style={{ backgroundImage: `url(${getBackgroundImageUrl(img)})` }}
          />
        ))}
        
        <div className="overlay" />
        
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-4">
          <img 
            src={getLogoUrl('white')} 
            alt="Tension Barber" 
            className="w-60 md:w-72 lg:w-80"
          />
          <p className="text-gray-400 text-xs tracking-[0.3em] mt-4">MUŠKI FRIZERSKI SALON</p>
        </div>
        
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-4">
          <div className="flex gap-2">
            {HERO_IMAGES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`slide-dot ${currentSlide === i ? 'active' : ''}`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
          <div className="text-gray-500 text-xs tracking-[0.2em] flex flex-col items-center">
            <span>SKROLUJ</span>
            <svg className="w-4 h-4 mt-1 animate-bounce-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </section>

      {/* ==================== SALON SELECTION ==================== */}
      <section id="salon-section" className="py-20 px-4 bg-black">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-xl md:text-2xl font-light tracking-[0.2em] mb-2">IZABERI SALON</h2>
          <p className="text-center text-gray-500 text-sm mb-12">Odaberi lokaciju za zakazivanje</p>
          
          <div className="grid md:grid-cols-2 gap-8">
            {salons.map((salon) => (
              <button
                key={salon.id}
                onClick={() => {
                  setSelectedSalon(salon)
                  setSelectedDate(null)
                  setSelectedBarber(null)
                  setSelectedTime(null)
                  scrollToSection('date-section')
                }}
                className={`group relative overflow-hidden rounded-lg border border-zinc-800 transition-all duration-300 hover:border-white ${selectedSalon?.id === salon.id ? 'border-white' : ''}`}
              >
                <div className="aspect-[16/10] w-full">
                  <img 
                    src={`${STORAGE_URL}/shops/${salon.image}`}
                    alt={salon.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                
                <div className="absolute bottom-0 left-0 right-0 p-6 text-left">
                  <h3 className="text-2xl font-semibold">{salon.name}</h3>
                  <p className="text-gray-300 text-sm mt-1">{salon.address}</p>
                  <p className="text-gray-500 text-xs">Novi Sad</p>
                  <div className="mt-4 text-xs text-gray-400 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {salon.barbers.length} berbera
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== DATE SELECTION ==================== */}
      {selectedSalon && (
        <section id="date-section" className="py-20 px-4 bg-zinc-950">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
              <div>
                <h2 className="text-xl md:text-2xl font-light tracking-[0.2em]">IZABERI DATUM</h2>
                <p className="text-gray-500 text-sm mt-1">{selectedSalon.address}, Novi Sad</p>
              </div>
              <button 
                onClick={() => {
                  setSelectedSalon(null)
                  setSelectedDate(null)
                  setSelectedBarber(null)
                  setSelectedTime(null)
                  scrollToSection('salon-section')
                }} 
                className="text-gray-500 text-sm underline underline-offset-4 hover:text-white transition"
              >
                ← Promeni salon
              </button>
            </div>
            
            <div className="grid grid-cols-7 gap-2">
              {dates.map((date, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedDate(date)
                    setSelectedBarber(null)
                    setSelectedTime(null)
                    scrollToSection('barber-section')
                  }}
                  className={`date-btn p-3 rounded text-center ${selectedDate?.iso === date.iso ? 'selected' : ''}`}
                >
                  <div className="text-xs opacity-60">{date.day}</div>
                  <div className="text-lg font-semibold">{date.dayNum}</div>
                  <div className="text-xs opacity-40">{date.month}.</div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ==================== BARBER SELECTION ==================== */}
      {selectedDate && (
        <section id="barber-section" className="py-20 px-4 bg-black">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xl md:text-2xl font-light tracking-[0.2em] mb-2">IZABERI BERBERA I TERMIN</h2>
            <p className="text-gray-500 text-sm mb-12">{selectedDate.day}, {selectedDate.formatted}</p>
            
            {loadingSlots ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto"></div>
                <p className="text-gray-500 mt-4">Učitavanje termina...</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {selectedSalon.barbers.map((barber) => {
                  const timeSlots = getTimeSlots(barber.id)
                  return (
                    <div key={barber.id} className="bg-zinc-900 rounded-lg overflow-hidden">
                      <div className="aspect-square bg-zinc-800 relative">
                        <img
                          src={getBarberImage(barber)}
                          alt={barber.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = `https://ui-avatars.com/api/?name=${barber.name}&background=222&color=fff&size=400`
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                        <h3 className="absolute bottom-4 left-4 text-xl font-semibold">{barber.name}</h3>
                      </div>
                      
                      <div className="p-4">
                        <p className="text-xs text-gray-500 mb-3 tracking-wider">SLOBODNI TERMINI</p>
                        {timeSlots.length === 0 ? (
                          <p className="text-gray-600 text-sm text-center py-4">Nema slobodnih termina</p>
                        ) : (
                          <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                            {timeSlots.map((time, i) => (
                              <button
                                key={i}
                                onClick={() => {
                                  setSelectedBarber(barber)
                                  setSelectedTime(time)
                                  setShowForm(true)
                                }}
                                className="time-btn py-2 text-xs rounded"
                              >
                                {time}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ==================== CENOVNIK ==================== */}
      <section className="py-20 px-4 bg-black">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-center text-xl md:text-2xl font-light tracking-[0.2em] mb-12">CENOVNIK</h2>
          
          <div className="space-y-0">
            {priceList.map((item) => (
              <div 
                key={item.id} 
                className="flex justify-between items-center py-4 border-b border-zinc-800"
              >
                <span className="text-sm md:text-base text-gray-300">{item.name.toUpperCase()}</span>
                <span className="text-sm md:text-base text-white font-medium">
                  {item.price ? `${item.price.toLocaleString()} RSD` : '***'}
                </span>
              </div>
            ))}
          </div>
          
          <p className="text-center text-gray-600 text-xs mt-8">*** Cena po dogovoru</p>
        </div>
      </section>

      {/* ==================== O NAMA ==================== */}
      <section className="py-20 px-4 bg-zinc-950 border-t border-zinc-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-xl md:text-2xl font-light tracking-[0.2em] mb-16">O NAMA</h2>
          
          <div className="grid md:grid-cols-3 gap-12 text-center">
            <div>
              <div className="w-14 h-14 mx-auto mb-5 rounded-full border border-zinc-700 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-medium text-sm tracking-wider mb-4">RADNO VREME</h3>
              <div className="text-sm text-gray-400 space-y-3">
                <div>
                  <p className="text-gray-500 text-xs">Bulevar kralja Petra I</p>
                  <p className="text-white font-medium">10:00 - 18:00</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Bulevar patrijarha Pavla</p>
                  <p className="text-white font-medium">10:00 - 22:00</p>
                </div>
                <div className="pt-2">
                  <p className="text-gray-500">Nedelja</p>
                  <p className="text-white font-medium">Neradna</p>
                </div>
              </div>
            </div>
            
            <div>
              <div className="w-14 h-14 mx-auto mb-5 rounded-full border border-zinc-700 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-medium text-sm tracking-wider mb-4">ADRESE</h3>
              <div className="text-sm space-y-4">
                <div>
                  <p className="text-gray-400 text-xs mb-1">TENSION BARBER</p>
                  <p className="text-white">Bulevar kralja Petra I 85</p>
                  <p className="text-gray-500">Novi Sad</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">TENSION BARBER TELEP</p>
                  <p className="text-white">Bulevar patrijarha Pavla 117</p>
                  <p className="text-gray-500">Novi Sad</p>
                </div>
              </div>
            </div>
            
            <div>
              <div className="w-14 h-14 mx-auto mb-5 rounded-full border border-zinc-700 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <h3 className="font-medium text-sm tracking-wider mb-4">KONTAKT</h3>
              <div className="text-sm space-y-3">
                <div>
                  <p className="text-gray-400">Telefon</p>
                  <a href="tel:+381659741038" className="text-white hover:underline">065 9741 038</a>
                </div>
                <div>
                  <p className="text-gray-400">Email</p>
                  <a href="mailto:info@tension-barber.rs" className="text-white text-xs hover:underline">
                    info@tension-barber.rs
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="py-8 px-4 bg-black border-t border-zinc-900 text-center">
        <p className="text-zinc-600 text-xs">© {new Date().getFullYear()} TENSION BARBER. Sva prava zadržana.</p>
      </footer>

      {/* ==================== BOOKING MODAL ==================== */}
      {showForm && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-3 animate-fade-in overflow-y-auto"
          onClick={() => { setShowForm(false); setOpenDropdown(null); setSelectedAddons([]); }}
        >
          <div 
            className="bg-zinc-900 p-4 md:p-8 rounded-lg max-w-md w-full animate-slide-up my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg md:text-xl font-semibold">Zakaži termin</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedBarber?.name} • {selectedDate?.formatted} • {selectedTime}
                </p>
              </div>
              <button 
                onClick={() => { setShowForm(false); setOpenDropdown(null); setSelectedAddons([]); }} 
                className="text-gray-500 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-2.5">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Izaberite uslugu *</label>
                <select
                  required
                  className="w-full bg-black border border-zinc-700 rounded px-3 py-2.5 text-sm focus:border-white focus:outline-none transition appearance-none cursor-pointer"
                  value={selectedService?.id || ''}
                  onChange={(e) => {
                    const service = SERVICES.find(s => s.id === parseInt(e.target.value))
                    setSelectedService(service)
                    setSelectedAddons([]) // Reset addons when service changes
                  }}
                >
                  <option value="">-- Izaberite uslugu --</option>
                  {SERVICES.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} {service.price ? `- ${service.price.toLocaleString()} RSD` : '- cena po dogovoru'}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Addon services - only show for haircut services */}
              {selectedService && SISANJE_SERVICE_IDS.includes(selectedService.id) && (
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <label className="text-xs text-gray-400 block mb-2">Dodatne usluge (opciono)</label>
                  <div className="space-y-1.5">
                    {ADDON_SERVICES.map((addon) => {
                      const isSelected = selectedAddons.some(a => a.id === addon.id)
                      return (
                        <button
                          key={addon.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedAddons(selectedAddons.filter(a => a.id !== addon.id))
                            } else {
                              setSelectedAddons([...selectedAddons, addon])
                            }
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition
                            ${isSelected 
                              ? 'bg-white text-black' 
                              : 'bg-black/50 text-white hover:bg-black/70'}`}
                        >
                          <span>{addon.name}</span>
                          <span className="flex items-center gap-2">
                            <span className={isSelected ? 'text-black/70' : 'text-gray-400'}>
                              {addon.price} RSD
                            </span>
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                              ${isSelected ? 'bg-black text-white' : 'bg-white/20 text-white'}`}>
                              {isSelected ? '✓' : '+'}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {selectedAddons.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-zinc-700 flex justify-between text-sm">
                      <span className="text-gray-400">Dodatno:</span>
                      <span className="text-white font-medium">
                        +{selectedAddons.reduce((sum, a) => sum + a.price, 0).toLocaleString()} RSD
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div>
                <input
                  type="email"
                  required
                  placeholder="Email adresa *"
                  className="w-full bg-black border border-zinc-700 rounded px-3 py-2.5 text-base focus:border-white focus:outline-none transition"
                  style={{ fontSize: '16px' }}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <input
                  type="text"
                  required
                  placeholder="Ime *"
                  className="w-full bg-black border border-zinc-700 rounded px-3 py-2.5 text-base focus:border-white focus:outline-none transition"
                  style={{ fontSize: '16px' }}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <input
                  type="tel"
                  required
                  placeholder="Telefon *"
                  className="w-full bg-black border border-zinc-700 rounded px-3 py-2.5 text-base focus:border-white focus:outline-none transition"
                  style={{ fontSize: '16px' }}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Datum rođenja (za popust)</label>
                <div className="grid grid-cols-3 gap-2">
                  {/* Day Button */}
                  <button
                    type="button"
                    onClick={() => setOpenDropdown('day')}
                    className="w-full bg-black border border-zinc-700 rounded px-2 py-2.5 text-sm text-center flex items-center justify-between"
                  >
                    <span className="flex-1">{form.birthDay || 'Dan'}</span>
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {/* Month Button */}
                  <button
                    type="button"
                    onClick={() => setOpenDropdown('month')}
                    className="w-full bg-black border border-zinc-700 rounded px-2 py-2.5 text-sm text-center flex items-center justify-between"
                  >
                    <span className="flex-1">{form.birthMonth ? ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'][parseInt(form.birthMonth) - 1] : 'Mesec'}</span>
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {/* Year Button */}
                  <button
                    type="button"
                    onClick={() => setOpenDropdown('year')}
                    className="w-full bg-black border border-zinc-700 rounded px-2 py-2.5 text-sm text-center flex items-center justify-between"
                  >
                    <span className="flex-1">{form.birthYear || 'Godina'}</span>
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting || !selectedService}
                className="w-full bg-white text-black font-semibold py-3 rounded hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed mt-1"
              >
                {isSubmitting ? 'ČEKAJTE...' : 'POTVRDI REZERVACIJU'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== DATE PICKER MODAL ==================== */}
      {openDropdown && ['day', 'month', 'year'].includes(openDropdown) && (
        <div 
          className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setOpenDropdown(null)}
        >
          <div 
            className="bg-zinc-900 rounded-2xl w-full max-w-xs max-h-[70vh] overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-700 text-center">
              <h3 className="font-medium text-lg">
                {openDropdown === 'day' && 'Izaberi dan'}
                {openDropdown === 'month' && 'Izaberi mesec'}
                {openDropdown === 'year' && 'Izaberi godinu'}
              </h3>
            </div>
            <div className="overflow-y-auto max-h-[50vh] p-2">
              {openDropdown === 'day' && (
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => { 
                        setForm({ ...form, birthDay: day.toString().padStart(2, '0') }); 
                        setOpenDropdown(null); 
                      }}
                      className={`p-3 rounded-lg text-center text-lg font-medium transition
                        ${form.birthDay === day.toString().padStart(2, '0') 
                          ? 'bg-white text-black' 
                          : 'bg-zinc-800 hover:bg-zinc-700'}`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              )}
              {openDropdown === 'month' && (
                <div className="grid grid-cols-3 gap-2">
                  {['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'].map((month, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { 
                        setForm({ ...form, birthMonth: (i + 1).toString().padStart(2, '0') }); 
                        setOpenDropdown(null); 
                      }}
                      className={`p-3 rounded-lg text-center font-medium transition
                        ${form.birthMonth === (i + 1).toString().padStart(2, '0') 
                          ? 'bg-white text-black' 
                          : 'bg-zinc-800 hover:bg-zinc-700'}`}
                    >
                      {month}
                    </button>
                  ))}
                </div>
              )}
              {openDropdown === 'year' && (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 80 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <button
                      key={year}
                      type="button"
                      onClick={() => { 
                        setForm({ ...form, birthYear: year.toString() }); 
                        setOpenDropdown(null); 
                      }}
                      className={`p-2.5 rounded-lg text-center text-sm font-medium transition
                        ${form.birthYear === year.toString() 
                          ? 'bg-white text-black' 
                          : 'bg-zinc-800 hover:bg-zinc-700'}`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-3 border-t border-zinc-700">
              <button
                type="button"
                onClick={() => setOpenDropdown(null)}
                className="w-full py-3 rounded-lg bg-zinc-800 text-white font-medium"
              >
                Zatvori
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== BOOKING ANIMATION ==================== */}
      {bookingAnimation && (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-500
          ${bookingAnimation === 'logo' ? 'bg-black/90' : ''}
          ${bookingAnimation === 'fade' ? 'bg-black/0' : ''}`}
        >
          <img 
            src={getLogoUrl('white')} 
            alt="Tension Barber" 
            className={`w-48 md:w-60 transition-all duration-500
              ${bookingAnimation === 'logo' ? 'opacity-100 scale-100' : ''}
              ${bookingAnimation === 'fade' ? 'opacity-0 scale-95' : ''}`}
          />
        </div>
      )}

      {/* ==================== NO NEXT SLOT WARNING ==================== */}
      {showNoNextSlotWarning && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80"
          onClick={() => setShowNoNextSlotWarning(false)}
        >
          <div 
            className="bg-gradient-to-br from-orange-500/90 to-orange-700/80 backdrop-blur-sm text-white px-6 py-6 rounded-lg shadow-2xl animate-slide-up max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center gap-3">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-semibold text-xl">Izaberite drugi termin</p>
                <p className="text-orange-100 text-sm mt-2">
                  Za ovu uslugu je potrebno više vremena. Molimo izaberite termin koji ima slobodan termin posle sebe.
                </p>
              </div>
              <button
                onClick={() => setShowNoNextSlotWarning(false)}
                className="mt-2 w-full py-3 rounded-lg bg-white/20 hover:bg-white/30 transition font-medium"
              >
                Razumem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CONFIRMATION ==================== */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-green-600 text-white px-6 py-6 rounded-lg shadow-2xl animate-slide-up max-w-sm w-full">
            <div className="flex flex-col items-center text-center gap-3">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="font-semibold text-xl">Rezervacija potvrđena!</p>
                {confirmedBooking && (
                  <div className="mt-3 text-sm space-y-1 text-green-100">
                    <p>{confirmedBooking.service.name}</p>
                    <p className="font-semibold text-white text-base">
                      {confirmedBooking.service.price 
                        ? `Cena: ${confirmedBooking.service.price.toLocaleString()} RSD`
                        : 'Cena: po dogovoru'
                      }
                    </p>
                  </div>
                )}
                <p className="text-xs mt-3 text-green-200">
                  Potvrda će biti poslata na email.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
