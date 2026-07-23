'use client';

import { AuthGuard } from '@/components/auth/AuthGuard';
import { FilterControls } from '@/components/dashboard/FilterControls';
import { HybridChart } from '@/components/dashboard/HybridChart';
import { PivotDataGrid } from '@/components/dashboard/PivotDataGrid';

export default function DashboardPage() {
  return (
    <AuthGuard>
      <div className="px-6 py-6">
        <h1 className="mb-4 text-2xl">IR 대시보드</h1>
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div>
            <FilterControls />
          </div>
          <div className="space-y-6">
            <HybridChart />
            <PivotDataGrid />
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
