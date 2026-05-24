import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  const isAdminRoute = path.startsWith('/admin');
  const isLogin      = path === '/admin/login';

  if (isAdminRoute && !isLogin && !user) {
    const url = new URL('/admin/login', request.url);
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  if (isLogin && user) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Run on everything except static assets and Next.js internals.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
