import { notFound } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { HouseSwitcher } from '@/components/house-switcher';
import { BottomTabBar, SectionNav } from '@/components/section-nav';
import { TopBar } from '@/components/top-bar';
import { requireDirector } from '@/lib/auth';
import { HOUSES, findHouseBySlug } from '@/lib/houses';

// Unknown slugs 404 before any Clerk or DB work. Pages still render per request.
export const dynamicParams = false;

export function generateStaticParams() {
  return HOUSES.map((house) => ({ house: house.slug }));
}

// Every route under /[house] runs in the context of that House (FR-004,
// FR-005). Pages still call requireDirector() themselves: layouts and pages
// render in parallel.
export default async function HouseLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ house: string }> }>) {
  await requireDirector();
  const { house: slug } = await params;
  const house = findHouseBySlug(slug);
  if (!house) notFound();

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <TopBar
        breadcrumb={
          <>
            <HouseSwitcher activeSlug={house.slug} />
            <SectionNav houseSlug={house.slug} />
          </>
        }
      >
        <UserButton />
      </TopBar>
      <div className="border-b border-border bg-card px-4 py-2 md:hidden">
        <HouseSwitcher activeSlug={house.slug} className="flex w-full" />
      </div>
      {children}
      <BottomTabBar houseSlug={house.slug} />
    </div>
  );
}
