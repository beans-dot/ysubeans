'use client';

import { AuthGuard } from '@/components/auth/AuthGuard';
import { MonitoringDashboard } from '@/components/monitoring/MonitoringDashboard';

export default function MonitoringPage() {
  return (
    <AuthGuard>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-2 text-2xl">대학 주요 현황 모니터링</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          자체 핵심 지표를 한눈에 보고, 전년 대비 변화와 계열·학과 현황을
          확인합니다.
        </p>
        <MonitoringDashboard />
      </div>
    </AuthGuard>
  );
}
