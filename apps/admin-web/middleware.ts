import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const locales = ['vi', 'en'];
const defaultLocale = 'vi';

const authRoutes = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('adminAccessToken')?.value;

  // Check if pathname starts with a locale
  const pathnameLocale = locales.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );

  if (pathnameLocale) {
    const subPath = pathname.replace(`/${pathnameLocale}`, '') || '/';
    const isAuthRoute = authRoutes.some(
      (route) => subPath === route || subPath.startsWith(`${route}/`)
    );

    // If logged in, do not allow accessing /login
    if (token && isAuthRoute) {
      return NextResponse.redirect(new URL(`/${pathnameLocale}`, request.url));
    }

    const response = NextResponse.next();
    response.cookies.set('NEXT_LOCALE', pathnameLocale, { path: '/' });
    return response;
  }

  // Get saved locale from cookies or default
  const savedLocale = request.cookies.get('NEXT_LOCALE')?.value;
  const locale = locales.includes(savedLocale || '') ? savedLocale! : defaultLocale;

  const isAuthRoute = authRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (token && isAuthRoute) {
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  request.nextUrl.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  const response = NextResponse.redirect(request.nextUrl);
  response.cookies.set('NEXT_LOCALE', locale, { path: '/' });
  return response;
}

export const config = {
  matcher: [
    // Skip static files, api routes, next internals
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
