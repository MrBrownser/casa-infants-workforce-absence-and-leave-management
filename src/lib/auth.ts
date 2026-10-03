import 'server-only';
import { currentUser } from '@clerk/nextjs/server';

// Roles (employee, manager, admin, ...) are not modelled yet. Add them here
// once the time and leave domain is specced.
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error('Not authorized');
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
  return { userId: user.id, name };
}
