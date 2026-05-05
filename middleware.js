import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/confirm',
  '/auth/callback',
  '/api',
  '/onboarding',
  '/terms',
  '/privacy',
];

const ADMIN_ROUTES = ['/admin', '/backstage'];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow public routes through without any checks
  const isPublic = PUBLIC_ROUTES.some(
    route => pathname === route || pathname.startsWith(route + '/')
  );
  if (isPublic) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value, options)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, family_id')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin';

  // Admin users: redirect to /backstage if trying to access family portal
  if (isAdmin && !pathname.startsWith('/backstage') && !pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/backstage', request.url));
  }

  // Admin route protection: non-admins cannot access /backstage or /admin
  const isAdminRoute = ADMIN_ROUTES.some(route => pathname.startsWith(route));
  if (isAdminRoute && !isAdmin) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Family users: check onboarding completion separately
  if (!isAdmin && profile?.family_id) {
    const { data: family } = await supabase
      .from('families')
      .select('is_onboarding_complete')
      .eq('id', profile.family_id)
      .single();

    if (!family?.is_onboarding_complete && pathname !== '/onboarding') {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};