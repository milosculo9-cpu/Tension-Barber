'use client';

import { useState, useEffect } from 'react';
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
  
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setShowSwipe(true);
    }, 1500);
    
    return () => clearTimeout(timer1);
  }, []);

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
      
      {/* Preloader */}
      {preloading && (
        <div className={`fixed inset-0 bg-black z-50 flex flex-col items-center justify-center transition-transform duration-500 ${showSwipe && !preloading ? '-translate-y-full' : 'translate-y-0'}`}>
          <img
            src="https://ygczcwuwmxhnbbfipfby.supabase.co/storage/v1/object/public/logo/logo.white.PNG"
            alt="Tension Barber"
            className="h-24 mb-8"
          />
          
          {/* Swipe indicator */}
          {showSwipe && (
            <button 
              onClick={handleSwipeUp}
              className="animate-bounce flex flex-col items-center text-white/50 mt-8"
            >
              <svg className="w-8 h-8 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span className="text-sm mt-2">Prevuci na gore</span>
            </button>
          )}
        </div>
      )}

      {/* Main content */}
      <div className={`w-full max-w-md transition-all duration-500 ${showForm ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        
        {/* Title */}
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
}
