'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const supabase = createClientComponentClient();

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
        setError('Pogrešan email ili lozinka');
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
      setError('Došlo je do greške. Pokušajte ponovo.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="relative w-full max-w-md">
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-24 h-1 bg-[#C6A962]" />
        
        <div className="bg-[#111111] border border-[#222222] rounded-lg p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white tracking-wider">TENSION</h1>
            <p className="text-[#C6A962] text-sm tracking-[0.3em] mt-1">BARBER ADMIN</p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[#888888] text-sm mb-2 tracking-wide">EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#333333] rounded px-4 py-3 text-white focus:border-[#C6A962] focus:outline-none transition-colors"
                placeholder="vas@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-[#888888] text-sm mb-2 tracking-wide">LOZINKA</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#333333] rounded px-4 py-3 text-white focus:border-[#C6A962] focus:outline-none transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#C6A962] text-black font-semibold py-3 rounded hover:bg-[#d4bc7c] transition-colors disabled:opacity-50"
            >
              {loading ? 'PRIJAVLJIVANJE...' : 'PRIJAVI SE'}
            </button>
          </form>

          <p className="text-center text-[#444444] text-xs mt-8">Tension Barber © 2026</p>
        </div>
      </div>
    </div>
  );
}
