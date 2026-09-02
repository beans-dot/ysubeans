'use client';

import { formatValueWithUnit } from '@/lib/dataFormatters';
import {
  aggregateDeptMaps,
  UNIV_ONLY_HIERARCHY_MESSAGE,
} from '@/lib/monitoring/aggregate';
import {
  assignHighlightBands,
  highlightClassName,
} from '@/lib/monitoring/percentiles';
import type { KpiViewModel } from '@/lib/monitoring/fetchMonitoringData';
import type { OrgStructure, YearValueMap } from '@/lib/monitoring/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

function cellText(
  value: number | null | undefined,
  unit: string | null,
  missing: string,
) {
  if (value == null) return missing;
  return formatValueWithUnit(value, unit);
}

function bandClass(
  bands: Record<string, 'top' | 'bottom' | 'none'>,
  id: string,
) {
  return highlightClassName(bands[id] ?? 'none');
}

export function HierarchyAccordionTable({
  view,
  org,
}: {
  view: KpiViewModel;
  org: OrgStructure;
}) {
  const year = view.selectedYear ?? view.years[view.years.length - 1];
  const univValue = year != null ? (view.univ[year] ?? null) : null;
  const method = view.kpi.seriesAggregation;

  const seriesRows = org.series.map((series) => {
    const deptMaps = series.departments.map(
      (d) => view.depts[d.deptCode] ?? {},
    );
    const aggregated: YearValueMap =
      year != null
        ? aggregateDeptMaps(deptMaps, [year], method)
        : {};
    return {
      series,
      value: year != null ? (aggregated[year] ?? null) : null,
    };
  });

  const seriesBands = assignHighlightBands(
    seriesRows.map((r) => ({ id: r.series.id, value: r.value })),
    view.kpi.direction,
  );

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="grid grid-cols-[1fr_auto] items-center bg-muted/50 px-4 py-2 text-xs font-bold text-muted-foreground">
        <span>구분</span>
        <span>{year ? `${year}년` : '값'}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-center border-b px-4 py-3">
        <span className="font-bold">{org.univName} (대학)</span>
        <span className="font-bold">
          {cellText(univValue, view.unit, '-')}
        </span>
      </div>
      {!view.hasHierarchy ? (
        <div className="px-4 py-3 text-sm text-muted-foreground">
          {UNIV_ONLY_HIERARCHY_MESSAGE}
        </div>
      ) : (
        <Accordion type="multiple" className="w-full">
          {seriesRows.map(({ series, value }) => {
            const deptItems = series.departments.map((dept) => ({
              id: dept.deptCode,
              name: dept.deptName,
              value:
                year != null
                  ? (view.depts[dept.deptCode]?.[year] ?? null)
                  : null,
            }));
            const deptBands = assignHighlightBands(
              deptItems.map((d) => ({ id: d.id, value: d.value })),
              view.kpi.direction,
            );
            return (
              <AccordionItem key={series.id} value={series.id}>
                <AccordionTrigger
                  className={cn(
                    'px-4 hover:no-underline',
                    bandClass(seriesBands, series.id),
                  )}
                >
                  <span className="flex w-full items-center justify-between pr-2">
                    <span>{series.name}</span>
                    <span>{cellText(value, view.unit, 'N/A')}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="divide-y">
                    {deptItems.map((dept) => (
                      <div
                        key={dept.id}
                        className={cn(
                          'grid grid-cols-[1fr_auto] px-8 py-2 text-sm',
                          bandClass(deptBands, dept.id),
                        )}
                      >
                        <span>{dept.name}</span>
                        <span>{cellText(dept.value, view.unit, 'N/A')}</span>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
