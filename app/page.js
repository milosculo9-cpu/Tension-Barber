'use client'

import { useState, useEffect } from 'react'
import { supabase, STORAGE_URL, getLogoUrl, getBarberImageUrl, getBackgroundImageUrl } from '@/lib/supabase'

const HERO_IMAGES = [
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
  const [form, setForm] = useState({ email: '', name: '', phone: '', birthday: '' })
  const [showNavbar, setShowNavbar] = useState(true)
  const [confirmedBooking, setConfirmedBooking] = useState(null)
  
  // Real data from Supabase
  const [locations, setLocations] = useState([])
  const [barbers, setBarbers] = useState([])
  const [services, setServices] = useState([])
  const [availableSlots, setAvailableSlots] = useState({}) // { barber_id: [slots] }
  const [loadingSlots, setLoadingSlots] = useState(false)
  
  const dates = generateDates()

  // Load locations, barbers, and services from Supabase
  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    // Load locations
    const { data: locationsData } = await supabase
      .from('locations')
      .select('*')
      .order('id')
    
    if (locationsData) {
      setLocations(locationsData.map(loc => ({
        id: loc.id,
        name: loc.name.includes('Petra') ? 'Tension Barber I' : 'Tension Barber II',
        address: loc.name.replace('Tension Barber - ', ''),
        fullName: loc.name,
        slug: loc.name.includes('Petra') ? 'bulevar-kralja-petra' : 'bulevar-patrijarha-pavla',
        image: loc.name.includes('Petra') ? 'shop.jpeg' : 'shop2.jpeg',
      })))
    }

    // Load barbers with their location
    const { data: barbersData } = await supabase
      .from('barbers')
      .select('*, locations(id, name)')
      .order('name')
    
    if (barbersData) {
      setBarbers(barbersData.map(b => ({
        id: b.id,
        name: b.name,
        slug: b.name.toLowerCase()
          .replace(/đ/g, 'dj')
          .replace(/č/g, 'c')
          .replace(/ć/g, 'c')
          .replace(/š/g, 's')
          .replace(/ž/g, 'z')
          .replace(/[^a-z]/g, ''),
        location_id: b.location_id,
        image_url: b.image_url
      })))
    }

    // Load services
    const { data: servicesData } = await supabase
      .from('services')
      .select('*')
      .order('price')
    
    if (servicesData) {
      setServices(servicesData)
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
    
    // Get barbers for this location
    const salonBarbers = barbers.filter(b => b.location_id === selectedSalon.id)
    const barberIds = salonBarbers.map(b => b.id)
    
    // Fetch available slots for all barbers at this location for this date
    const { data: slots } = await supabase
      .from('barber_available_slots')
      .select('*')
      .in('barber_id', barberIds)
      .eq('slot_date', selectedDate.iso)
      .eq('is_booked', false)
      .order('slot_time')
    
    // Group slots by barber
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

    const salonBarbers = barbers.filter(b => b.location_id === selectedSalon.id)
    const barberIds = salonBarbers.map(b => b.id)
    
    // Subscribe to changes in barber_available_slots
    const channel = supabase
      .channel('slots-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'barber_available_slots',
          filter: `slot_date=eq.${selectedDate.iso}`
        },
        (payload) => {
          console.log('Slot change:', payload)
          // Reload slots when any change happens
          loadAvailableSlots()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedDate, selectedSalon, barbers])

  // Preload critical images
  useEffect(() => {
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
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_IMAGES.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [])

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

  // Handle booking submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!selectedService) {
      alert('Molimo izaberite uslugu.')
      return
    }
    
    setIsSubmitting(true)

    try {
      // Save customer data to localStorage
      localStorage.setItem('tensionBarberCustomer', JSON.stringify(form))

      // Create appointment in Supabase
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          barber_id: selectedBarber.id,
          customer_name: form.name,
          customer_email: form.email,
          customer_phone: form.phone,
          customer_birthday: form.birthday || null,
          service_name: selectedService.name,
          service_price: selectedService.price,
          appointment_date: selectedDate.iso,
          appointment_time: selectedTime + ':00',
          status: 'confirmed'
        })
        .select()
        .single()

      if (appointmentError) {
        console.error('Error creating appointment:', appointmentError)
        alert('Došlo je do greške. Pokušajte ponovo.')
        setIsSubmitting(false)
        return
      }

      // Mark the slot as booked
      const { error: slotError } = await supabase
        .from('barber_available_slots')
        .update({ is_booked: true })
        .eq('barber_id', selectedBarber.id)
        .eq('slot_date', selectedDate.iso)
        .eq('slot_time', selectedTime + ':00')

      if (slotError) {
        console.error('Error updating slot:', slotError)
      }

      // Remove the booked slot from available slots
      setAvailableSlots(prev => ({
        ...prev,
        [selectedBarber.id]: prev[selectedBarber.id]?.filter(t => t !== selectedTime) || []
      }))

      // Show confirmation
      setConfirmedBooking({
        service: selectedService,
        barber: selectedBarber,
        date: selectedDate,
        time: selectedTime
      })
      
      setShowForm(false)
      setShowConfirm(true)
      
      // Hide confirmation after 5 seconds
      setTimeout(() => {
        setShowConfirm(false)
        setConfirmedBooking(null)
      }, 5000)

      // Reset selection
      setSelectedBarber(null)
      setSelectedTime(null)
      setSelectedService(null)

    } catch (err) {
      console.error('Booking error:', err)
      alert('Došlo je do greške. Pokušajte ponovo.')
    }
    
    setIsSubmitting(false)
  }

  // Get barbers for current salon
  const getSalonBarbers = () => {
    if (!selectedSalon) return []
    return barbers.filter(b => b.location_id === selectedSalon.id)
  }

  // Get barber image URL
  const getBarberImage = (barber) => {
    if (barber.image_url) return barber.image_url
    return `${STORAGE_URL}/barbers/${barber.slug}.jpeg`
  }

  return (
    <main className="min-h-screen bg-black text-white">
      
      {/* ==================== PRELOADER ==================== */}
      {isLoading && (
        <div className={`fixed inset-0 z-[100] bg-black flex items-center justify-center transition-opacity duration-1000 ${preloaderFading ? 'opacity-0' : 'opacity-100'}`}>
          <div className="text-center">
            <img 
              src={getLogoUrl('white')} 
              alt="Tension Barber" 
              className="h-20 md:h-28 mx-auto animate-pulse"
            />
            <div className="mt-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== NAVBAR ==================== */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${showNavbar ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'}`}>
        <div className="bg-gradient-to-b from-black/90 via-black/60 to-transparent">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <img 
                src={getLogoUrl('white')} 
                alt="Tension Barber" 
                className="h-8 md:h-10"
              />
              <div className="flex gap-6 text-sm text-gray-300">
                <button onClick={() => scrollToSection('booking')} className="hover:text-white transition hidden md:block">
                  REZERVIŠI
                </button>
                <button onClick={() => scrollToSection('cenovnik')} className="hover:text-white transition hidden md:block">
                  CENOVNIK
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* ==================== HERO SLIDER ==================== */}
      <section className="relative h-screen">
        <div className="absolute inset-0">
          {HERO_IMAGES.map((img, i) => (
            <div 
              key={i}
              className={`absolute inset-0 transition-opacity duration-1000 ${i === currentSlide ? 'opacity-100' : 'opacity-0'}`}
            >
              <img 
                src={getBackgroundImageUrl(img)} 
                alt="" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50" />
            </div>
          ))}
        </div>
        
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <img 
            src={getLogoUrl('white')} 
            alt="Tension Barber" 
            className="h-28 md:h-40 mb-6"
          />
          <p className="text-gray-300 text-sm tracking-[0.3em] mb-10">NOVI SAD</p>
          <button 
            onClick={() => scrollToSection('booking')}
            className="bg-white text-black px-10 py-4 text-sm tracking-widest hover:bg-gray-200 transition"
          >
            REZERVIŠI TERMIN
          </button>
        </div>

        {/* Slide indicators */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex gap-2">
          {HERO_IMAGES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`w-2 h-2 rounded-full transition ${i === currentSlide ? 'bg-white' : 'bg-white/30'}`}
            />
          ))}
        </div>
      </section>

      {/* ==================== BOOKING SECTION ==================== */}
      <section id="booking" className="py-20 px-4 bg-zinc-950">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-center text-xl md:text-2xl font-light tracking-[0.2em] mb-16">REZERVACIJA</h2>
          
          {/* Step 1: Choose Location */}
          <div className="mb-16">
            <p className="text-center text-gray-500 text-sm mb-6 tracking-wider">1. IZABERITE LOKACIJU</p>
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {locations.map((salon) => (
                <button
                  key={salon.id}
                  onClick={() => {
                    setSelectedSalon(salon)
                    setSelectedDate(null)
                    setAvailableSlots({})
                    scrollToSection('date-picker')
                  }}
                  className={`relative overflow-hidden rounded-lg aspect-[4/3] group ${
                    selectedSalon?.id === salon.id ? 'ring-2 ring-white' : ''
                  }`}
                >
                  <img 
                    src={getBackgroundImageUrl(salon.image)} 
                    alt={salon.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                  />
                  <div className="absolute inset-0 bg-black/60 group-hover:bg-black/50 transition" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <h3 className="text-lg md:text-xl font-semibold mb-2">{salon.name}</h3>
                    <p className="text-gray-400 text-sm">{salon.address}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Choose Date */}
          {selectedSalon && (
            <div id="date-picker" className="mb-16 animate-fade-in">
              <p className="text-center text-gray-500 text-sm mb-6 tracking-wider">2. IZABERITE DATUM</p>
              <div className="flex gap-3 overflow-x-auto pb-4 justify-start md:justify-center scrollbar-hide">
                {dates.map((date, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedDate(date)
                      scrollToSection('barbers')
                    }}
                    disabled={date.day === 'Ned'}
                    className={`flex-shrink-0 w-16 py-3 rounded-lg text-center transition ${
                      date.day === 'Ned' 
                        ? 'bg-zinc-900 text-zinc-700 cursor-not-allowed' 
                        : selectedDate?.iso === date.iso 
                          ? 'bg-white text-black' 
                          : 'bg-zinc-900 text-white hover:bg-zinc-800'
                    }`}
                  >
                    <p className="text-xs text-inherit opacity-60">{date.day}</p>
                    <p className="text-lg font-semibold">{date.dayNum}</p>
                    <p className="text-xs text-inherit opacity-60">{date.month}/{date.year.toString().slice(2)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Choose Barber & Time */}
          {selectedSalon && selectedDate && (
            <div id="barbers" className="animate-fade-in">
              <p className="text-center text-gray-500 text-sm mb-2 tracking-wider">3. IZABERITE BERBERA I TERMIN</p>
              <p className="text-center text-gray-600 text-xs mb-8">{selectedDate.day}, {selectedDate.formatted}</p>
              
              {loadingSlots ? (
                <div className="text-center py-12">
                  <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto"></div>
                  <p className="text-gray-500 mt-4">Učitavanje termina...</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {getSalonBarbers().map((barber) => {
                    const slots = availableSlots[barber.id] || []
                    return (
                      <div key={barber.id} className="bg-zinc-900 rounded-lg overflow-hidden">
                        {/* Barber Photo */}
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
                        
                        {/* Time Slots */}
                        <div className="p-4">
                          <p className="text-xs text-gray-500 mb-3 tracking-wider">SLOBODNI TERMINI</p>
                          {slots.length === 0 ? (
                            <p className="text-gray-600 text-sm text-center py-4">Nema slobodnih termina</p>
                          ) : (
                            <>
                              <div className="grid grid-cols-4 gap-2">
                                {slots.slice(0, 8).map((time, i) => (
                                  <button
                                    key={i}
                                    onClick={() => {
                                      setSelectedBarber(barber)
                                      setSelectedTime(time)
                                      setShowForm(true)
                                    }}
                                    className="time-btn py-2 text-xs rounded bg-zinc-800 hover:bg-white hover:text-black transition"
                                  >
                                    {time}
                                  </button>
                                ))}
                              </div>
                              {slots.length > 8 && (
                                <p className="text-xs text-gray-600 mt-3 text-center">
                                  + još {slots.length - 8} termina
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ==================== CENOVNIK ==================== */}
      <section id="cenovnik" className="py-20 px-4 bg-black">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-center text-xl md:text-2xl font-light tracking-[0.2em] mb-12">CENOVNIK</h2>
          
          <div className="space-y-0">
            {services.map((service, i) => (
              <div 
                key={service.id || i} 
                className="flex justify-between items-center py-4 border-b border-zinc-800"
              >
                <span className="text-sm md:text-base text-gray-300">{service.name?.toUpperCase()}</span>
                <span className="text-sm md:text-base text-white font-medium">
                  {service.price ? `${service.price.toLocaleString()} RSD` : '***'}
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
            {/* Radno vreme */}
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
            
            {/* Adrese */}
            <div>
              <div className="w-14 h-14 mx-auto mb-5 rounded-full border border-zinc-700 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-medium text-sm tracking-wider mb-4">ADRESE</h3>
              <div className="text-sm space-y-3">
                <div>
                  <p className="text-white">Bulevar kralja Petra I 85</p>
                  <p className="text-gray-500">Novi Sad</p>
                </div>
                <div>
                  <p className="text-white">Bulevar patrijarha Pavla 117</p>
                  <p className="text-gray-500">Novi Sad</p>
                </div>
              </div>
            </div>
            
            {/* Kontakt */}
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
                  <a href="mailto:tension.barbershop1@gmail.com" className="text-white text-xs hover:underline">
                    tension.barbershop1@gmail.com
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
          onClick={() => setShowForm(false)}
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
                onClick={() => setShowForm(false)} 
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
                    const service = services.find(s => s.id === e.target.value)
                    setSelectedService(service)
                  }}
                >
                  <option value="">-- Izaberite uslugu --</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} {service.price ? `- ${service.price.toLocaleString()} RSD` : '- cena po dogovoru'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <input
                  type="email"
                  required
                  placeholder="Email adresa *"
                  className="w-full bg-black border border-zinc-700 rounded px-3 py-2.5 text-sm focus:border-white focus:outline-none transition"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <input
                  type="text"
                  required
                  placeholder="Ime *"
                  className="w-full bg-black border border-zinc-700 rounded px-3 py-2.5 text-sm focus:border-white focus:outline-none transition"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <input
                  type="tel"
                  required
                  placeholder="Telefon *"
                  className="w-full bg-black border border-zinc-700 rounded px-3 py-2.5 text-sm focus:border-white focus:outline-none transition"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Datum rođenja (za popust)</label>
                <div className="w-full bg-black border border-zinc-700 rounded px-3 py-2.5">
                  <input
                    type="date"
                    className="w-full bg-transparent text-sm focus:outline-none"
                    value={form.birthday}
                    onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                  />
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

      {/* ==================== CONFIRMATION ==================== */}
      {showConfirm && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-5 rounded-lg shadow-2xl animate-slide-up max-w-sm w-full mx-4">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="font-semibold text-lg">Rezervacija potvrđena!</p>
              {confirmedBooking && (
                <div className="mt-2 text-sm text-green-100 space-y-1">
                  <p>{confirmedBooking.service.name}</p>
                  <p className="font-semibold text-white">
                    {confirmedBooking.service.price 
                      ? `Cena: ${confirmedBooking.service.price.toLocaleString()} RSD`
                      : 'Cena: po dogovoru'
                    }
                  </p>
                </div>
              )}
              <p className="text-xs text-green-200 mt-2">Potvrda će biti poslata na email.</p>
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
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-slide-up {
          animation: slideUp 0.3s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        select option {
          background: #000;
          color: white;
        }
      `}</style>
    </main>
  )
}
