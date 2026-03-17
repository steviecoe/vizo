import { ImpersonationBanner } from '@/components/layout/ImpersonationBanner';
import { LowCreditBanner } from '@/components/layout/LowCreditBanner';
import { DashboardShell } from '@/components/layout/DashboardShell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <ImpersonationBanner />
      <LowCreditBanner />
      <DashboardShell>
        {children}
      </DashboardShell>
    </div>
  );
}
