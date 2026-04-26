import { NextResponse } from 'next/server';

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/confirm',
];

const ADMIN_ROUTES = ['/admin'];

export function proxy(request) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_ROUTES.some(
    route => pathname === route || pathname.startsWith(route + '/')
  );

  if (isPublic) return NextResponse.next();

  const token = request.cookies.get('sb-access-token')?.value ||
    request.cookies.getAll().find(c => c.name.includes('auth-token'))?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const isAdmin = ADMIN_ROUTES.some(route => pathname.startsWith(route));
  if (isAdmin) {
    try {
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString()
      );
      if (payload?.app_metadata?.role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};