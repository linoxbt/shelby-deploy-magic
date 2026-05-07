import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get('host') || '';

  // 1. Skip if main domain or local
  const mainDomains = [
    'shelbyhost.xyz',
    'shelbyhost.pages.dev',
    'localhost:3000',
    'localhost:5173',
  ];
  
  const isMainDomain = mainDomains.some(d => hostname === d || hostname.endsWith('.vercel.app'));
  
  if (isMainDomain) {
    return NextResponse.next();
  }

  // 2. Handle subdomains
  const parts = hostname.split('.');
  
  // Example: myapp.shelbyhost.xyz -> slug is 'myapp'
  // If user is using a custom domain (not shelbyhost.xyz), we'd need more logic
  if (parts.length >= 3) {
    const slug = parts[0];
    const path = url.pathname === '/' ? '/index.html' : url.pathname;

    // Rewrite to the API route we found in /api/proxy-project.ts
    // Vercel serverless functions in /api/ are mapped to /api/*
    url.pathname = `/api/proxy-project`;
    url.searchParams.set('slug', slug);
    url.searchParams.set('path', path);

    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (internal api calls)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
