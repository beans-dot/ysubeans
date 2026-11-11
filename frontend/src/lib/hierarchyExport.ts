import { api, type PivotResult, type PivotRow, type TargetTreeNode } from '@/lib/api';
import type { SelectedTarget } from '@/store/useDashboardStore';

const UNIV_GROUP_LEVELS = new Set(['root', 'schoolType', 'region', 'regionCity']);

export interface HierarchyExportTarget extends SelectedTarget {
  /** 트리 level. 엑셀 위계 열에 씁니다. */
  level: string;
  levelLabel: string;
}

interface FlatNode {
  node: TargetTreeNode;
  pathLabel: string;
  /** 자기 자신을 뺀 조상 id */
  ancestorIds: string[];
  ancestorUniv?: string;
  ancestorYeonsung?: boolean;
}

export function hierarchyLevelLabel(level: string): string {
  switch (level) {
    case 'schoolType':
      return '학교종류';
    case 'region':
      return '권역';
    case 'regionCity':
      return '지역';
    case 'univ':
      return '대학';
    case 'series':
      return '계열';
    case 'dept':
      return '학과';
    case 'root':
      return '대학';
    default:
      return level;
  }
}

function childPathLabel(
  node: TargetTreeNode,
  child: TargetTreeNode,
  pathLabel: string,
): string {
  if (child.level === 'dept' || child.level === 'univ') return child.label;
  if (child.level === 'series') {
    const base =
      node.level === 'root' || node.level === 'univ'
        ? pathLabel || node.label
        : pathLabel;
    return base ? `${base} · ${child.label}` : child.label;
  }
  if (node.level === 'root' && !node.isYeonsung) return child.label;
  return pathLabel ? `${pathLabel} · ${child.label}` : child.label;
}

function flattenTree(tree: TargetTreeNode[]): FlatNode[] {
  const out: FlatNode[] = [];
  const walk = (
    node: TargetTreeNode,
    pathLabel: string,
    ancestors: string[],
    ancestorUniv?: string,
    ancestorYeonsung?: boolean,
  ) => {
    out.push({
      node,
      pathLabel,
      ancestorIds: ancestors,
      ancestorUniv,
      ancestorYeonsung,
    });
    const nextAncestors = [...ancestors, node.id];
    const univ = node.univCode ?? ancestorUniv;
    const yeonsung = !!(node.isYeonsung || ancestorYeonsung);
    for (const child of node.children ?? []) {
      walk(
        child,
        childPathLabel(node, child, pathLabel),
        nextAncestors,
        univ,
        yeonsung,
      );
    }
  };
  for (const root of tree) {
    walk(root, root.label, [], root.univCode, !!root.isYeonsung);
  }
  return out;
}

function collectUnivs(node: TargetTreeNode): string[] {
  const codes = new Set<string>();
  const walk = (n: TargetTreeNode) => {
    if (n.level === 'univ' && n.univCode) codes.add(n.univCode);
    n.children?.forEach(walk);
  };
  walk(node);
  return Array.from(codes);
}

function collectDepts(node: TargetTreeNode, ancestorUniv?: string): string[] {
  const out: string[] = [];
  const walk = (n: TargetTreeNode, univ?: string) => {
    const code = n.univCode ?? univ;
    if (n.level === 'dept' && n.deptCode && code) out.push(n.deptCode);
    n.children?.forEach((child) => walk(child, n.univCode ?? univ));
  };
  walk(node, ancestorUniv);
  return out;
}

/** 트리에서 그 노드를 그대로 조회할 때와 같은 대상. 섹션처럼 조회 대상이 아니면 null. */
function targetFromFlat(flat: FlatNode): SelectedTarget | null {
  const { node, pathLabel, ancestorUniv, ancestorYeonsung } = flat;
  const univCode = node.univCode ?? ancestorUniv;
  const isYeonsung = !!(node.isYeonsung || ancestorYeonsung);

  if (
    !(node.isYeonsung && node.level === 'root') &&
    UNIV_GROUP_LEVELS.has(node.level)
  ) {
    const memberUnivCodes = collectUnivs(node);
    if (memberUnivCodes.length === 0) return null;
    return {
      key: node.id,
      label: `${pathLabel} (평균)`,
      isYeonsung: false,
      mode: 'group',
      memberUnivCodes,
    };
  }

  if (node.isYeonsung && node.level === 'root' && univCode) {
    if (node.memberDeptCodes && node.memberDeptCodes.length > 0) {
      return {
        key: node.id,
        label: node.label,
        isYeonsung: true,
        mode: 'group',
        univCode,
        memberDeptCodes: node.memberDeptCodes,
      };
    }
    return {
      key: univCode,
      label: node.label,
      isYeonsung: true,
      mode: 'individual',
      univCode,
    };
  }

  if (node.level === 'series') {
    if (!univCode) return null;
    const memberDeptCodes = collectDepts(node, univCode);
    if (memberDeptCodes.length === 0) return null;
    return {
      key: node.id,
      label: `${pathLabel} (평균)`,
      isYeonsung,
      mode: 'group',
      univCode,
      memberDeptCodes,
    };
  }

  if (node.level === 'univ' && node.univCode) {
    return {
      key: node.univCode,
      label: node.label,
      isYeonsung: !!node.isYeonsung,
      mode: 'individual',
      univCode: node.univCode,
    };
  }

  if (node.level === 'dept' && node.deptCode && univCode && node.selectable) {
    return {
      key: `${univCode}::${node.deptCode}`,
      label: node.label,
      isYeonsung,
      mode: 'individual',
      univCode,
      deptCode: node.deptCode,
    };
  }

  return null;
}

function toExportTarget(
  target: SelectedTarget,
  level: string,
): HierarchyExportTarget {
  return {
    ...target,
    level,
    levelLabel: hierarchyLevelLabel(level),
  };
}

/** 대학 전체(전 학과 평균). 트리에서는 계열 섹션과 형제로 떨어져 있다. */
function isYeonsungAllDeptGroup(target: SelectedTarget): boolean {
  return (
    target.mode === 'group' &&
    target.key === 'root:yeonsung' &&
    (target.memberDeptCodes?.length ?? 0) > 0
  );
}

function descendantNodes(flat: FlatNode[], target: SelectedTarget): FlatNode[] {
  if (target.mode !== 'group') return [];
  if (isYeonsungAllDeptGroup(target)) {
    return flat.filter(
      (item) => item.node.level === 'series' || item.node.level === 'dept',
    );
  }
  return flat.filter((item) => item.ancestorIds.includes(target.key));
}

function descendantsOf(
  flat: FlatNode[],
  target: SelectedTarget,
): HierarchyExportTarget[] {
  const out: HierarchyExportTarget[] = [];
  for (const item of descendantNodes(flat, target)) {
    const next = targetFromFlat(item);
    if (!next || next.key === target.key) continue;
    out.push(toExportTarget(next, item.node.level));
  }
  return out;
}

function leafExportTarget(
  flat: FlatNode[],
  target: SelectedTarget,
): HierarchyExportTarget {
  const matched = flat.find((item) => {
    const next = targetFromFlat(item);
    return next?.key === target.key;
  });
  const level =
    matched?.node.level ??
    (target.deptCode ? 'dept' : target.mode === 'group' ? 'root' : 'univ');
  return toExportTarget(target, level);
}

/** 선택한 대상 중 아래에 위계가 더 있는 것이 있는지. 대학·학과만이면 false. */
export function selectionHasSubHierarchy(
  tree: TargetTreeNode[],
  selected: SelectedTarget[],
): boolean {
  if (!tree.length || !selected.length) return false;
  const flat = flattenTree(tree);
  return selected.some((target) => descendantsOf(flat, target).length > 0);
}

/**
 * 그룹은 그 아래 위계 전체(중간 평균 + 최하위)로 바꾸고,
 * 이미 최하위인 선택은 그대로 둔다.
 */
export function expandHierarchyTargets(
  tree: TargetTreeNode[],
  selected: SelectedTarget[],
): HierarchyExportTarget[] {
  const flat = flattenTree(tree);
  const out: HierarchyExportTarget[] = [];
  const seen = new Set<string>();
  const push = (target: HierarchyExportTarget) => {
    if (seen.has(target.key)) return;
    seen.add(target.key);
    out.push(target);
  };
  for (const target of selected) {
    const descendants = descendantsOf(flat, target);
    if (descendants.length === 0) {
      push(leafExportTarget(flat, target));
      continue;
    }
    descendants.forEach(push);
  }
  return out;
}

function toPivotPayload(targets: SelectedTarget[]) {
  return targets.map((target) => {
    if (target.mode === 'group') {
      return {
        groupKey: target.key,
        groupLabel: target.label,
        isYeonsung: target.isYeonsung,
        univCode: target.univCode,
        memberUnivCodes: target.memberUnivCodes,
        memberDeptCodes: target.memberDeptCodes,
      };
    }
    return {
      univCode: target.univCode as string,
      deptCode: target.deptCode,
    };
  });
}

export async function fetchExpandedPivot(input: {
  tree: TargetTreeNode[];
  selected: SelectedTarget[];
  metricIds: number[];
  years: number[];
}): Promise<{ pivot: PivotResult; targets: HierarchyExportTarget[] }> {
  const targets = expandHierarchyTargets(input.tree, input.selected);
  const { data } = await api.post<PivotResult>(
    '/pivot',
    {
      targets: toPivotPayload(targets),
      metricIds: input.metricIds,
      years: input.years,
      hierarchyIntegrate: false,
    },
    { timeout: 120000 },
  );
  return { pivot: data, targets };
}

/** 피벗 행을 펼친 위계 순서, 그 안에서 지표 선택 순으로 맞춘다. */
export function orderPivotRows(
  rows: PivotRow[],
  targets: HierarchyExportTarget[],
  metricIds: number[],
): PivotRow[] {
  const targetIndex = new Map(targets.map((target, index) => [target.key, index]));
  const metricIndex = new Map(metricIds.map((id, index) => [id, index]));
  const rank = (row: PivotRow) => {
    const key = pivotRowTargetKey(row);
    return targetIndex.get(key) ?? targetIndex.get(row.targetKey) ?? 1_000_000;
  };
  return [...rows].sort((a, b) => {
    const targetDelta = rank(a) - rank(b);
    if (targetDelta !== 0) return targetDelta;
    return (
      (metricIndex.get(a.metricId) ?? 1_000_000) -
      (metricIndex.get(b.metricId) ?? 1_000_000)
    );
  });
}

export function pivotRowTargetKey(row: PivotRow): string {
  if (row.deptCode) return `${row.univCode}::${row.deptCode}`;
  if (row.targetKey.endsWith('::_ALL_')) return row.univCode;
  return row.targetKey;
}

export function levelLabelForRow(
  row: PivotRow,
  targets: HierarchyExportTarget[],
): string {
  const key = pivotRowTargetKey(row);
  const found = targets.find(
    (target) => target.key === key || target.key === row.targetKey,
  );
  return found?.levelLabel ?? '';
}
