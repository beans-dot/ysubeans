'use client';

import { PlanDeptManager } from './strategic-plan/PlanDeptManager';
import { InternalOrgManager } from './InternalOrgManager';

export function OrgManager() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">조직 관리</h2>
        <p className="text-sm text-muted-foreground">
          계열·학과와 중장기발전계획 부서를 한곳에서 관리합니다.
        </p>
      </div>
      <InternalOrgManager />
      <PlanDeptManager />
    </div>
  );
}
