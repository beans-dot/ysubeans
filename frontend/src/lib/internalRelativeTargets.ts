import type { TargetTreeNode } from '@/lib/api';
import type { SelectedTarget } from '@/store/useDashboardStore';

export interface RelativeExpandOptions {
  allSeries: boolean;
  allDepts: boolean;
}

function collectDepts(node: TargetTreeNode): string[] {
  const out: string[] = [];
  const walk = (n: TargetTreeNode) => {
    if (n.level === 'dept' && n.deptCode) out.push(n.deptCode);
    n.children?.forEach(walk);
  };
  walk(node);
  return out;
}

export function collectYeonsungUnivTarget(
  tree: TargetTreeNode[],
): SelectedTarget | null {
  const walk = (
    n: TargetTreeNode,
    ancestorUniv?: string,
  ): SelectedTarget | null => {
    const univ = n.univCode ?? ancestorUniv;
    if (n.isYeonsung && n.level === 'root' && univ) {
      const memberDeptCodes =
        n.memberDeptCodes && n.memberDeptCodes.length > 0
          ? n.memberDeptCodes
          : collectDepts(n);
      if (memberDeptCodes.length === 0) return null;
      return {
        key: n.id,
        label: n.label,
        isYeonsung: true,
        mode: 'group',
        univCode: univ,
        memberDeptCodes,
      };
    }
    for (const c of n.children ?? []) {
      const found = walk(c, univ);
      if (found) return found;
    }
    return null;
  };
  for (const root of tree) {
    const found = walk(root);
    if (found) return found;
  }
  return null;
}

export function collectAllSeriesTargets(
  tree: TargetTreeNode[],
): SelectedTarget[] {
  const out: SelectedTarget[] = [];
  const walk = (
    n: TargetTreeNode,
    ancestorUniv?: string,
    ancestorYeonsung?: boolean,
  ) => {
    const univ = n.univCode ?? ancestorUniv;
    const isY = !!(n.isYeonsung || ancestorYeonsung);
    if (n.level === 'series' && univ) {
      const memberDeptCodes = collectDepts(n);
      if (memberDeptCodes.length > 0) {
        out.push({
          key: n.id,
          label: `${n.label} (평균)`,
          isYeonsung: isY,
          mode: 'group',
          univCode: univ,
          memberDeptCodes,
        });
      }
    }
    n.children?.forEach((c) => walk(c, univ, isY));
  };
  tree.forEach((r) => walk(r));
  return out;
}

export function collectAllDeptTargets(tree: TargetTreeNode[]): SelectedTarget[] {
  const out: SelectedTarget[] = [];
  const walk = (
    n: TargetTreeNode,
    ancestorUniv?: string,
    ancestorYeonsung?: boolean,
  ) => {
    const univ = n.univCode ?? ancestorUniv;
    const isY = !!(n.isYeonsung || ancestorYeonsung);
    if (n.level === 'dept' && n.selectable && univ && n.deptCode) {
      out.push({
        key: `${univ}::${n.deptCode}`,
        label: n.label,
        isYeonsung: isY,
        mode: 'individual',
        univCode: univ,
        deptCode: n.deptCode,
      });
    }
    n.children?.forEach((c) => walk(c, univ, isY));
  };
  tree.forEach((r) => walk(r));
  return out;
}

/**
 * 상대비교 대상:
 * - 대학 평균은 항상 포함
 * - 전체 계열/학과 옵션이 켜지면 선택과 무관하게 해당 위계 전체
 * - 둘 다 꺼지면 현재 선택 + 대학 평균
 */
export function collectInternalRelativeTargets(
  tree: TargetTreeNode[],
  selected: SelectedTarget[],
  expand: RelativeExpandOptions,
): SelectedTarget[] {
  const byKey = new Map<string, SelectedTarget>();
  const univ = collectYeonsungUnivTarget(tree);
  if (univ) byKey.set(univ.key, univ);

  if (expand.allSeries) {
    collectAllSeriesTargets(tree).forEach((t) => byKey.set(t.key, t));
  }
  if (expand.allDepts) {
    collectAllDeptTargets(tree).forEach((t) => byKey.set(t.key, t));
  }
  if (!expand.allSeries && !expand.allDepts) {
    selected.forEach((t) => byKey.set(t.key, t));
  }

  return Array.from(byKey.values());
}
