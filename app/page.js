'use client'

import { useState, useEffect } from 'react'
import { supabase, STORAGE_URL, getLogoUrl, getBarberImageUrl, getBackgroundImageUrl } from '@/lib/supabase'

// Static data (will be replaced with Supabase data later)
const SALONS = [
  {
    id: 1,
    name: 'Tension Barber I',
    address: 'Bulevar kralja Petra I 85',
    fullName: 'Tension Barber I - Bulevar kralja Petra I 85',
    slug: 'bulevar-kralja-petra',
    image: 'shop1.jpeg',
    barbers: [
      { id: 1, name: 'Crni', slug: 'crni' },
      { id: 2, name: 'Kole', slug: 'kole' },
      { id: 3, name: 'Anđelo', slug: 'andjelo' },
    ]
  },
  {
    id: 2,
    name: 'Tension Barber II',
    address: 'Bulevar patrijarha Pavla 117',
    fullName: 'Tension Barber II - Bulevar patrijarha Pavla 117',
    slug: 'bulevar-patrijarha-pavla',
    image: 'shop2.jpeg',
    barbers: [
      { id: 4, name: 'Rade', slug: 'rade' },
      { id: 5, name: 'Milan', slug: 'milan' },
      { id: 6, name: 'Filip', slug: 'filip' },
      { id: 7, name: 'Manča', slug: 'manca' },
    ]
  }
]

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

// Generate time slots (mock - will be replaced with real availability)
function generateTimeSlots(barberId) {
  const slots = []
  const seed = barberId * 7
  for (let hour = 9; hour <= 22; hour++) {
    if ((hour + seed) % 3 !== 0) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`)
    }
    if (hour < 22 && (hour + seed) % 4 !== 0) {
      slots.push(`${hour.toString().padStart(2, '0')}:30`)
    }
  }
  return slots.slice(0, 10)
}

export default function Home() {
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
  
  const dates = generateDates()

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
      // Only show navbar when at the very top
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
        const offset = 20 // Small offset from top
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
      // Insert appointment into Supabase
      const { data, error } = await supabase
        .from('appointments')
        .insert([
          {
            barber_id: selectedBarber.id,
            service_name: selectedService.name,
            service_price: selectedService.price,
            customer_name: form.name,
            customer_email: form.email,
            customer_phone: form.phone,
            customer_birthday: form.birthday || null,
            appointment_date: selectedDate.iso,
            appointment_time: selectedTime,
            duration_minutes: 30,
            status: 'confirmed'
          }
        ])

      if (error) throw error

      // Save customer data to localStorage for next time
      localStorage.setItem('tensionBarberCustomer', JSON.stringify(form))

      // Save booking info for confirmation display
      setConfirmedBooking({
        service: selectedService,
        barber: selectedBarber,
        date: selectedDate,
        time: selectedTime
      })

      // Success
      setShowForm(false)
      setShowConfirm(true)
      setSelectedService(null)
      // Don't reset form - keep data for next booking
      
      setTimeout(() => {
        setShowConfirm(false)
        setConfirmedBooking(null)
        setSelectedSalon(null)
        setSelectedDate(null)
        setSelectedBarber(null)
        setSelectedTime(null)
      }, 5000)

    } catch (error) {
      console.error('Booking error:', error)
      alert('Došlo je do greške. Pokušajte ponovo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      
      {/* ==================== NAVBAR ==================== */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${showNavbar ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="bg-gradient-to-b from-black via-black/80 to-transparent pt-5 pb-12 px-6">
          <h1 className="text-center text-xl md:text-2xl font-light tracking-[0.2em]">TENSION BARBER</h1>
        </div>
      </nav>
      
      {/* ==================== HERO SECTION ==================== */}
      <section className="hero-section">
        {/* Background Slides */}
        {HERO_IMAGES.map((img, i) => (
          <div
            key={i}
            className={`slide ${currentSlide === i ? 'active' : ''}`}
            style={{ backgroundImage: `url(${getBackgroundImageUrl(img)})` }}
          />
        ))}
        
        {/* Overlay */}
        <div className="overlay" />
        
        {/* Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-4">
          <img 
            src={getLogoUrl('white')} 
            alt="Tension Barber" 
            className="w-60 md:w-72 lg:w-80"
          />
          <p className="text-gray-400 text-xs tracking-[0.3em] mt-4">MUŠKI FRIZERSKI SALON</p>
        </div>
        
        {/* Slide Indicators & Scroll */}
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
            {SALONS.map((salon) => (
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
                {/* Background Image */}
                <div className="aspect-[16/10] w-full">
                  <img 
                    src={`${STORAGE_URL}/shops/${salon.image}`}
                    alt={salon.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                
                {/* Content */}
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
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {selectedSalon.barbers.map((barber) => {
                const timeSlots = generateTimeSlots(barber.id)
                return (
                  <div key={barber.id} className="bg-zinc-900 rounded-lg overflow-hidden">
                    {/* Barber Photo */}
                    <div className="aspect-square bg-zinc-800 relative">
                      <img
                        src={getBarberImageUrl(barber.slug)}
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
                      <div className="grid grid-cols-4 gap-2">
                        {timeSlots.slice(0, 8).map((time, i) => (
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
                      {timeSlots.length > 8 && (
                        <p className="text-xs text-gray-600 mt-3 text-center">
                          + još {timeSlots.length - 8} termina
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ==================== CENOVNIK ==================== */}
      <section className="py-20 px-4 bg-black">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-center text-xl md:text-2xl font-light tracking-[0.2em] mb-12">CENOVNIK</h2>
          
          <div className="space-y-0">
            {[
              { service: 'ŠIŠANJE "FEJD"', price: '1.200' },
              { service: 'ŠIŠANJE DUŽA KOSA', price: '1.500' },
              { service: 'ŠIŠANJE ZATVORSKI', price: '800' },
              { service: 'BRIJANJE GLAVE BRITVOM', price: '800' },
              { service: 'TRIMOVANJE I KONTURE BRADE', price: '600' },
              { service: 'KONTURE BRADE', price: '350' },
              { service: 'OBLIKOVANJE OBRVA KONCEM', price: '400' },
              { service: 'OBLIKOVANJE OBRVA BRITVOM', price: '300' },
              { service: 'PRANJE KOSE', price: '350' },
              { service: 'VOSAK UŠI', price: '300' },
              { service: 'VOSAK NOS', price: '300' },
              { service: 'FARBANJE KOSE', price: '***' },
              { service: 'FARBANJE BRADE', price: '***' },
              { service: 'TENSION FULL PAKET', price: '3.000' },
              { service: '"VANREDNO" ŠIŠANJE', price: '1.500' },
              { service: 'TENSION ALL INCLUSIVE', price: '3.500' },
            ].map((item, i) => (
              <div 
                key={i} 
                className="flex justify-between items-center py-4 border-b border-zinc-800"
              >
                <span className="text-sm md:text-base text-gray-300">{item.service}</span>
                <span className="text-sm md:text-base text-white font-medium">
                  {item.price === '***' ? '***' : `${item.price} RSD`}
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
              <div className="text-sm text-gray-400 space-y-1">
                <p>Ponedeljak - Subota</p>
                <p className="text-white font-medium">09:00 - 23:00</p>
                <p className="mt-3">Nedelja</p>
                <p className="text-white font-medium">12:00 - 18:00</p>
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
                    const service = SERVICES.find(s => s.id === parseInt(e.target.value))
                    setSelectedService(service)
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
    </main>
  )
}
