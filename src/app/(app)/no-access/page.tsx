import type { Metadata } from 'next';
import { NoAccess } from '@/components/no-access';

export const metadata: Metadata = {
  title: "Sense accés · Casa d'Infants",
};

// Deliberately does not call requireDirector(): this is where non-directors land.
export default function NoAccessPage() {
  return <NoAccess />;
}
