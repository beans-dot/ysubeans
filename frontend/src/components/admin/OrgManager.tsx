'use client';

import { useEffect, useState } from 'react';
import { InternalOrgManager } from './InternalOrgManager';
import { OfficeOrgManager } from './OfficeOrgManager';
import { OrgChangeLogManager } from './OrgChangeLogManager';
import { NativeSelect } from '@/components/strategic-plan/ui';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';

function rollingOrgYears(): number[] {
  const now = new Date().getFullYear();
  return Array.from({ length: 7 }, (_, i) => now - 5 + i);
}

export function OrgManager() {
  const [years, setYears] = useState<number[]>(() => rollingOrgYears());
  const [year, setYear] = useState(new Date().getFullYear());
  const [logKey, setLogKey] = useState(0);

  const bump = () => setLogKey((k) => k + 1);

  useEffect(() => {
    api
      .get<{ years: number[]; defaultYear: number }>('/internal-org/years')
      .then(({ data }) => {
        setYears(data.years);
        setYear(
          data.years.includes(data.defaultYear)
            ? data.defaultYear
            : data.years[data.years.length - 2] ?? data.defaultYear,
        );
      })
      .catch(() => {
        const fallback = rollingOrgYears();
        setYears(fallback);
        setYear(new Date().getFullYear());
      });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">조직 관리</h2>
        <p className="text-sm text-muted-foreground">
          계열·학과와 행정부서를 학년도별로 관리합니다. 선택한 학년도 이전
          조회는 그대로 두고, 해당 학년도부터 이름이 반영됩니다.
        </p>
      </div>

      <div className="flex min-w-0 flex-nowrap items-center gap-6 overflow-x-auto">
        <Label htmlFor="org-apply-year" className="shrink-0 whitespace-nowrap">
          변경 적용 학년도
        </Label>
        <NativeSelect
          id="org-apply-year"
          className="w-40 shrink-0"
          value={String(year)}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}학년도부터
            </option>
          ))}
        </NativeSelect>
        <p className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
          신설·학과명 변경·폐지는 이 학년도부터 조회 화면에 반영됩니다.
        </p>
      </div>

      <Tabs defaultValue="academic">
        <TabsList>
          <TabsTrigger value="academic">계열/학과</TabsTrigger>
          <TabsTrigger value="office">행정부서</TabsTrigger>
        </TabsList>
        <TabsContent value="academic">
          <InternalOrgManager year={year} onChanged={bump} />
        </TabsContent>
        <TabsContent value="office">
          <OfficeOrgManager year={year} onChanged={bump} />
        </TabsContent>
      </Tabs>

      <OrgChangeLogManager refreshKey={logKey} onRolledBack={bump} />
    </div>
  );
}
