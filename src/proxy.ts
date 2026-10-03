import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Next.js 16 renamed the `middleware` file convention to `proxy`.
// Clerk auto-detects this file and runs auth on matched routes.
const isPublic = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) {
    await auth.protect();
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
