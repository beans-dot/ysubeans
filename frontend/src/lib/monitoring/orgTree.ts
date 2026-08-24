import type { TargetTreeNode } from '@/lib/api';
import type { OrgSeries, OrgStructure } from './types';

function walk(nodes: TargetTreeNode[], visit: (n: TargetTreeNode) => void) {
  for (const n of nodes) {
    visit(n);
    if (n.children?.length) walk(n.children, visit);
  }
}

export function parseOrgTree(tree: TargetTreeNode[]): OrgStructure | null {
  let univCode = '';
  let univName = '';
  const series: OrgSeries[] = [];

  walk(tree, (n) => {
    if (
      n.isYeonsung &&
      n.univCode &&
      (n.level === 'root' || n.level === 'univ')
    ) {
      univCode = n.univCode;
      univName = n.label;
    }
  });

  walk(tree, (n) => {
    if (n.level !== 'series') return;
    const departments = (n.children ?? [])
      .filter((c) => c.level === 'dept' && c.deptCode)
      .map((c, deptIndex) => ({
        deptCode: c.deptCode as string,
        deptName: c.label,
        displayOrder: deptIndex,
      }));
    series.push({
      id: n.id,
      name: n.label,
      displayOrder: series.length,
      departments,
    });
  });

  if (!univCode) {
    walk(tree, (n) => {
      if (n.isYeonsung && n.univCode && !univCode) {
        univCode = n.univCode;
        univName = n.label;
      }
    });
  }

  if (!univCode) return null;
  return { univCode, univName, series };
}

export function allDeptCodes(org: OrgStructure): string[] {
  return org.series.flatMap((s) => s.departments.map((d) => d.deptCode));
}
