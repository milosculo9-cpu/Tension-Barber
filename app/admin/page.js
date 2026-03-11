'use client'

import { useState, useEffect } from 'react'
import { supabase, STORAGE_URL, getLogoUrl, getBarberImageUrl, getBackgroundImageUrl } from '@/lib/supabase'

// Static data (will be replaced with Supabase data later)
const SALONS = [
  {
    id: 1,
    name: 'Tension Barber',
    address: 'Bulevar kralja Petra I 85',
    fullName: 'Tension Barber Bulevar kralja Petra I 85',
    slug: 'bulevar-kralja-petra',
    barbers: [
      { id: 1, name: 'Crni', slug: 'crni' },
      { id: 2, name: 'Kole', slug: 'kole' },
      { id: 3, name: 'Anđelo', slug: 'andjelo' },
    ]
  },
  {
    id: 2,
    name: 'Tension Barber',
    address: 'Bulevar patrijarha Pavla 117',
    fullName: 'Tension Barber Bulevar patrijarha Pavla 117',
    slug: 'bulevar-patrijarha-pavla',
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
  'IMG_8162.jpeg',
  'IMG_8163.jpeg',
  'IMG_8166.jpeg',
  'IMG_8168.jpeg',
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
  const [showForm, setShowForm] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({ email: '', name: '', phone: '', birthday: '' })
  
  const dates = generateDates()

  // Auto-slide every 3 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_IMAGES.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  // Scroll to section
  const scrollToSection = (id) => {
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  // Handle booking submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Insert appointment into Supabase
      const { data, error } = await supabase
        .from('appointments')
        .insert([
          {
            barber_id: selectedBarber.id,
            service_id: '00000000-0000-0000-0000-000000000001', // Default service
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

      // Success
      setShowForm(false)
      setShowConfirm(true)
      setForm({ email: '', name: '', phone: '', birthday: '' })
      
      setTimeout(() => {
        setShowConfirm(false)
        setSelectedSalon(null)
        setSelectedDate(null)
        setSelectedBarber(null)
        setSelectedTime(null)
      }, 4000)

    } catch (error) {
      console.error('Booking error:', error)
      alert('Došlo je do greške. Pokušajte ponovo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      
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
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-xl md:text-2xl font-light tracking-[0.2em] mb-2">IZABERI SALON</h2>
          <p className="text-center text-gray-500 text-sm mb-12">Odaberi lokaciju za zakazivanje</p>
          
          <div className="grid md:grid-cols-2 gap-6">
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
                className={`salon-card p-8 text-left ${selectedSalon?.id === salon.id ? 'selected' : ''}`}
              >
                <h3 className="text-xl font-semibold">{salon.name}</h3>
                <p className="text-gray-400 text-sm mt-1">{salon.address}</p>
                <p className="text-gray-600 text-xs">Novi Sad</p>
                <div className="mt-5 text-xs text-gray-500 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {salon.barbers.length} berbera
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
                onClick={() => setSelectedSalon(null)} 
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
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setShowForm(false)}
        >
          <div 
            className="bg-zinc-900 p-6 md:p-8 rounded-lg max-w-md w-full animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
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
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="email"
                  required
                  placeholder="Email adresa *"
                  className="w-full bg-black border border-zinc-700 rounded px-4 py-3 text-sm focus:border-white focus:outline-none transition"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <input
                  type="text"
                  required
                  placeholder="Ime *"
                  className="w-full bg-black border border-zinc-700 rounded px-4 py-3 text-sm focus:border-white focus:outline-none transition"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <input
                  type="tel"
                  required
                  placeholder="Telefon *"
                  className="w-full bg-black border border-zinc-700 rounded px-4 py-3 text-sm focus:border-white focus:outline-none transition"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Datum rođenja (za popust)</label>
                <input
                  type="date"
                  className="w-full bg-black border border-zinc-700 rounded px-4 py-3 text-sm focus:border-white focus:outline-none transition"
                  value={form.birthday}
                  onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-white text-black font-semibold py-4 rounded hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {isSubmitting ? 'ČEKAJTE...' : 'POTVRDI REZERVACIJU'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== CONFIRMATION ==================== */}
      {showConfirm && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 animate-slide-up">
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="font-semibold">Termin uspešno zakazan!</p>
            <p className="text-sm text-green-200">Potvrda će biti poslata na email.</p>
          </div>
        </div>
      )}
    </main>
  )
}
