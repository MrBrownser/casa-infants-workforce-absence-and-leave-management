import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import {
  ACTIVE_HOUSE_COOKIE,
  ACTIVE_HOUSE_COOKIE_MAX_AGE,
  activeHouseCookieUpdate,
} from '@/lib/active-house';

// Next.js 16 renamed the `middleware` file convention to `proxy`.
// Clerk auto-detects this file and runs auth on matched routes.
const isPublic = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) {
    await auth.protect();
  }

  // Remember the last visited House for the /dashboard redirect. Server
  // Components cannot set cookies, so this is the one place that can.
  const slug = activeHouseCookieUpdate(req.nextUrl.pathname, req.cookies.get(ACTIVE_HOUSE_COOKIE)?.value);
  if (slug) {
    const response = NextResponse.next();
    response.cookies.set(ACTIVE_HOUSE_COOKIE, slug, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ACTIVE_HOUSE_COOKIE_MAX_AGE,
    });
    return response;
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
    // Clerk's auto-proxy path
    '/__clerk/:path*',
  ],
};
