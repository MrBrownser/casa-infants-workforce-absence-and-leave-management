import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACTIVE_HOUSE_COOKIE, resolveDashboardRedirect } from '@/lib/active-house';
import { requireDirector } from '@/lib/auth';

// Clerk's after-sign-in redirect lands here: send the director to the last
// House they visited, or to Paulo Freire.
export default async function DashboardPage() {
  await requireDirector();
  const cookieStore = await cookies();
  redirect(resolveDashboardRedirect(cookieStore.get(ACTIVE_HOUSE_COOKIE)?.value));
}
