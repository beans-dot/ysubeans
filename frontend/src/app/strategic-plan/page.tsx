'use client';

import { AuthGuard } from '@/components/auth/AuthGuard';
import { AutoSaveToastHost } from '@/components/admin/AutoSaveToast';
import { StrategicPlanDashboard } from '@/components/strategic-plan/StrategicPlanDashboard';

export default function StrategicPlanPage() {
  return (
    <AuthGuard>
      <div className="mx-auto max-w-[96rem] px-6 py-6">
        <h1 className="mb-4 text-2xl">중장기발전계획 성과관리</h1>
        <div className="sp-root">
          <StrategicPlanDashboard />
        </div>
        <AutoSaveToastHost />
      </div>
    </AuthGuard>
  );
}
