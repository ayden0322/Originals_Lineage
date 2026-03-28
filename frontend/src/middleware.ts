import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;

  // Skip API routes, static files, and auth routes
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/originals')
  ) {
    return NextResponse.next();
  }

  // Already has a valid prefix — pass through
  if (
    pathname.startsWith('/platform') ||
    pathname.startsWith('/module') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next();
  }

  // Determine which app to serve based on subdomain
  let prefix = '/public';

  if (hostname.startsWith('admin.') || hostname.startsWith('admin:')) {
    prefix = '/platform';
  } else if (
    hostname.startsWith('originals-admin.') ||
    hostname.startsWith('originals-admin:')
  ) {
    prefix = '/module';
  }

  // Also support query parameter for local development without /etc/hosts
  const appParam = request.nextUrl.searchParams.get('app');
  if (appParam === 'platform-admin') {
    prefix = '/platform';
  } else if (appParam === 'module-admin') {
    prefix = '/module';
  } else if (appParam === 'public') {
    prefix = '/public';
  }

  // Rewrite to the prefixed path
  const url = request.nextUrl.clone();
  url.pathname = `${prefix}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
