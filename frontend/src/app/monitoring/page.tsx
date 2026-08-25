'use client';

import { AuthGuard } from '@/components/auth/AuthGuard';
import { MonitoringDashboard } from '@/components/monitoring/MonitoringDashboard';

export default function MonitoringPage() {
  return (
    <AuthGuard>
      <div className="mx-auto max-w-6xl px-6 py-6">
        <h1 className="mb-4 text-2xl">대학 주요 현황 모니터링</h1>
        <MonitoringDashboard />
      </div>
    </AuthGuard>
  );
}
