'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchSpTree } from '@/lib/strategic-plan/api';
import type { SpTree } from '@/lib/strategic-plan/types';
import { PlanDeptManager } from './strategic-plan/PlanDeptManager';
import { PlanFundSourceManager } from './strategic-plan/PlanFundSourceManager';
import { PlanKpiManager } from './strategic-plan/PlanKpiManager';
import { PlanStructureManager } from './strategic-plan/PlanStructureManager';

export function StrategicPlanManager() {
  const [tree, setTree] = useState<SpTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const nextTree = await fetchSpTree();
      setTree(nextTree);
      setError(null);
    } catch {
      setError(
        '중장기발전계획 데이터를 불러오지 못했습니다. 초기 시딩이 끝났는지 확인해 주세요.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        불러오는 중입니다…
      </div>
    );
  }

  if (error || !tree) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        {error ?? '데이터가 없습니다.'}
      </div>
    );
  }

  return (
    <Tabs defaultValue="structure">
      <TabsList className="mb-4 h-auto flex-wrap justify-start">
        <TabsTrigger value="structure">체계</TabsTrigger>
        <TabsTrigger value="depts">부서관리</TabsTrigger>
        <TabsTrigger value="kpi">KPI 목표·실적</TabsTrigger>
        <TabsTrigger value="funds">재원 유형</TabsTrigger>
      </TabsList>

      <TabsContent value="structure">
        <PlanStructureManager tree={tree} reload={reload} />
      </TabsContent>

      <TabsContent value="depts">
        <PlanDeptManager reload={reload} />
      </TabsContent>

      <TabsContent value="kpi">
        <PlanKpiManager tree={tree} reload={reload} />
      </TabsContent>

      <TabsContent value="funds">
        <PlanFundSourceManager />
      </TabsContent>
    </Tabs>
  );
}
