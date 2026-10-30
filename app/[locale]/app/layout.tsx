import { Sidebar } from '@/components/Sidebar';
import { BlueprintGrid } from '@/components/BlueprintGrid';
import { RequireOnboarding } from '@/components/RequireOnboarding';
import { LanguageToggle } from '@/components/i18n/LanguageToggle';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <BlueprintGrid />
      <Sidebar />
      <div className="transition-[padding] duration-200 ease-out lg:pl-[var(--sbw)]">
        <div className="relative z-10 mx-auto hidden max-w-[1600px] justify-end px-margin pt-space-md lg:flex lg:px-margin-desktop">
          <LanguageToggle />
        </div>
        <main className="relative z-10 mx-auto max-w-[1600px] px-margin py-space-lg lg:px-margin-desktop lg:pt-space-sm">
          <RequireOnboarding>{children}</RequireOnboarding>
        </main>
      </div>
    </div>
  );
}
