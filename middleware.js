import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (req.nextUrl.pathname.startsWith('/admin/dashboard') && !session) {
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  if (req.nextUrl.pathname === '/admin' && session) {
    const { data: barber } = await supabase
      .from('barbers')
      .select('id')
      .eq('auth_user_id', session.user.id)
      .single();

    if (barber) {
      return NextResponse.redirect(new URL('/admin/dashboard', req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ['/admin/:path*'],
};
