import { Sidebar } from '@/components/Sidebar';
import { BlueprintGrid } from '@/components/BlueprintGrid';
import { RequireOnboarding } from '@/components/RequireOnboarding';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <BlueprintGrid />
      <Sidebar />
      <div className="transition-[padding] duration-200 ease-out lg:pl-[var(--sbw)]">
        <main className="relative z-10 mx-auto max-w-[1600px] px-margin py-space-lg lg:px-margin-desktop">
          <RequireOnboarding>{children}</RequireOnboarding>
        </main>
      </div>
    </div>
  );
}
