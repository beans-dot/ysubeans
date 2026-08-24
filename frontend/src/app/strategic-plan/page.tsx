'use client';

import { AuthGuard } from '@/components/auth/AuthGuard';
import { StrategicPlanDashboard } from '@/components/strategic-plan/StrategicPlanDashboard';

export default function StrategicPlanPage() {
  return (
    <AuthGuard>
      <div className="sp-root mx-auto max-w-7xl px-6 py-8">
        <h1 className="mb-2 font-bold">중장기발전계획 성과관리</h1>
        <p className="mb-6 text-muted-foreground">
          좌측 메뉴에서 화면을 고릅니다. 비전 체계는 조회만 가능하고, 중장기발전계획
          관리에서 입력한 예결산·자체평가는 성과관리 메뉴에서 연도별로 조회합니다.
        </p>
        <StrategicPlanDashboard />
      </div>
    </AuthGuard>
  );
}
