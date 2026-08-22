import type { TargetTreeNode } from '@/lib/api';
import type { SelectedTarget } from '@/store/useDashboardStore';

const UNIV_GROUP_LEVELS = new Set(['root', 'schoolType', 'region', 'regionCity']);

export type GroupKind = 'univ' | 'dept' | 'univ-individual';

export interface AggregatableNode {
  id: string;
  parentId?: string;
  label: string;
  pathLabel: string;
  depth: number;
  kind: GroupKind;
  isYeonsung: boolean;
  univCode?: string;
  memberUnivCodes?: string[];
  memberDeptCodes?: string[];
  univCodes: string[];
  deptsByUniv: Map<string, string[]>;
  leafKeys: string[];
  descendantKeys: string[];
}

function deptKey(univCode: string, deptCode: string) {
  return `${univCode}::${deptCode}`;
}

function collectDepts(
  node: TargetTreeNode,
  ancestorUniv?: string,
): Array<{ univCode: string; deptCode: string }> {
  const out: Array<{ univCode: string; deptCode: string }> = [];
  const walk = (n: TargetTreeNode, univ?: string) => {
    const u = n.univCode ?? univ;
    if (n.level === 'dept' && u && n.deptCode) {
      out.push({ univCode: u, deptCode: n.deptCode });
    }
    n.children?.forEach((c) => walk(c, n.univCode ?? univ));
  };
  walk(node, ancestorUniv);
  return out;
}

function collectUnivCodes(node: TargetTreeNode): string[] {
  const codes = new Set<string>();
  const walk = (n: TargetTreeNode) => {
    if (n.level === 'univ' && n.univCode) codes.add(n.univCode);
    if (n.level === 'root' && n.isYeonsung && n.univCode) codes.add(n.univCode);
    n.children?.forEach(walk);
  };
  walk(node);
  return Array.from(codes);
}

function collectDescendantKeys(
  node: TargetTreeNode,
  ancestorUnivCode?: string,
): string[] {
  const keys = new Set<string>([node.id]);
  const depts = collectDepts(node, ancestorUnivCode);
  depts.forEach(({ univCode, deptCode }) => keys.add(deptKey(univCode, deptCode)));
  collectUnivCodes(node).forEach((u) => keys.add(u));

  const walk = (n: TargetTreeNode) => {
    if (
      n.level === 'series' ||
      UNIV_GROUP_LEVELS.has(n.level) ||
      n.level === 'univ'
    ) {
      keys.add(n.id);
    }
    n.children?.forEach(walk);
  };
  walk(node);
  return Array.from(keys);
}

function isUnivGroupNode(node: TargetTreeNode): boolean {
  if (node.isYeonsung && node.level === 'root') return false;
  return UNIV_GROUP_LEVELS.has(node.level);
}

function isDeptGroupNode(node: TargetTreeNode): boolean {
  return node.level === 'series';
}

function isYeonsungRootNode(node: TargetTreeNode): boolean {
  return !!node.isYeonsung && node.level === 'root' && !!node.univCode;
}

function walkAggregatable(
  node: TargetTreeNode,
  depth: number,
  pathLabel: string,
  ancestorUnivCode: string | undefined,
  ancestorIsYeonsung: boolean,
  out: AggregatableNode[],
  parentId?: string,
) {
  const univCode = node.univCode ?? ancestorUnivCode;
  const isYeonsung = !!(node.isYeonsung || ancestorIsYeonsung);
  // pathLabel은 부모가 이미 이 노드 label까지 포함한 전체 경로
  const currentPath = pathLabel;
  let selfId: string | undefined;

  if (isUnivGroupNode(node)) {
    const memberUnivCodes = collectUnivCodes(node);
    const depts = collectDepts(node);
    const deptsByUniv = new Map<string, string[]>();
    depts.forEach(({ univCode: u, deptCode }) => {
      if (!deptsByUniv.has(u)) deptsByUniv.set(u, []);
      deptsByUniv.get(u)!.push(deptCode);
    });
    const leafKeys = [
      ...memberUnivCodes,
      ...depts.map((d) => deptKey(d.univCode, d.deptCode)),
    ];
    selfId = node.id;
    out.push({
      id: node.id,
      parentId,
      label: node.label,
      pathLabel: currentPath,
      depth,
      kind: 'univ',
      isYeonsung: false,
      memberUnivCodes,
      univCodes: memberUnivCodes,
      deptsByUniv,
      leafKeys,
      descendantKeys: collectDescendantKeys(node, univCode),
    });
  } else if (isYeonsungRootNode(node) && node.univCode) {
    const fromNode = node.memberDeptCodes ?? [];
    const depts =
      fromNode.length > 0
        ? fromNode.map((d) => ({ univCode: node.univCode as string, deptCode: d }))
        : collectDepts(node, node.univCode);
    const memberDeptCodes = depts.map((d) => d.deptCode);
    selfId = node.id;
    out.push({
      id: node.id,
      parentId,
      label: node.label,
      pathLabel: currentPath,
      depth,
      kind: fromNode.length > 0 ? 'dept' : 'univ-individual',
      isYeonsung: true,
      univCode: node.univCode,
      memberDeptCodes,
      univCodes: [node.univCode],
      deptsByUniv: new Map([[node.univCode, memberDeptCodes]]),
      leafKeys:
        fromNode.length > 0
          ? memberDeptCodes.map((d) => deptKey(node.univCode!, d))
          : [
              node.univCode,
              ...memberDeptCodes.map((d) => deptKey(node.univCode!, d)),
            ],
      descendantKeys:
        fromNode.length > 0
          ? [node.id]
          : collectDescendantKeys(node, node.univCode),
    });
  } else if (isDeptGroupNode(node) && univCode) {
    const depts = collectDepts(node, univCode);
    if (depts.length > 0) {
      const memberDeptCodes = depts.map((d) => d.deptCode);
      selfId = node.id;
      out.push({
        id: node.id,
        parentId,
        label: node.label,
        pathLabel: currentPath,
        depth,
        kind: 'dept',
        isYeonsung,
        univCode,
        memberDeptCodes,
        univCodes: [univCode],
        deptsByUniv: new Map([[univCode, memberDeptCodes]]),
        leafKeys: memberDeptCodes.map((d) => deptKey(univCode, d)),
        descendantKeys: collectDescendantKeys(node, univCode),
      });
    }
  } else if (
    node.level === 'univ' &&
    !node.isYeonsung &&
    node.univCode &&
    collectDepts(node).length > 0
  ) {
    const depts = collectDepts(node);
    const memberDeptCodes = depts.map((d) => d.deptCode);
    selfId = node.id;
    out.push({
      id: node.id,
      parentId,
      label: node.label,
      pathLabel: currentPath,
      depth,
      kind: 'univ-individual',
      isYeonsung: false,
      univCode: node.univCode,
      memberDeptCodes,
      univCodes: [node.univCode],
      deptsByUniv: new Map([[node.univCode, memberDeptCodes]]),
      leafKeys: memberDeptCodes.map((d) => deptKey(node.univCode!, d)),
      descendantKeys: collectDescendantKeys(node, univCode),
    });
  }

  node.children?.forEach((child) => {
    const childPath = (() => {
      if (child.level === 'dept' || child.level === 'univ') return child.label;
      if (child.level === 'series') {
        const base =
          node.level === 'root' || node.level === 'univ'
            ? currentPath || node.label
            : currentPath;
        return base ? `${base} · ${child.label}` : child.label;
      }
      if (node.level === 'root' && !node.isYeonsung) return child.label;
      return currentPath ? `${currentPath} · ${child.label}` : child.label;
    })();
    walkAggregatable(
      child,
      depth + 1,
      childPath,
      node.univCode ?? ancestorUnivCode,
      isYeonsung,
      out,
      selfId ?? parentId,
    );
  });
}

export function collectAggregatableNodes(tree: TargetTreeNode[]): AggregatableNode[] {
  const out: AggregatableNode[] = [];
  tree.forEach((root) => {
    walkAggregatable(root, 0, root.label, root.univCode, !!root.isYeonsung, out);
  });
  return out;
}

function isUnivCovered(
  univCode: string,
  selectedKeys: Set<string>,
  depts: string[] | undefined,
): boolean {
  if (selectedKeys.has(univCode)) return true;
  if (depts && depts.length > 0) {
    return depts.every((d) => selectedKeys.has(deptKey(univCode, d)));
  }
  return false;
}

/** UI 체크 상태용: 하위가 모두 선택되면 상위도 선택된 것으로 표시 */
export function isFullyCovered(
  node: AggregatableNode,
  selectedKeys: Set<string>,
  allNodes: AggregatableNode[] = [],
): boolean {
  if (selectedKeys.has(node.id)) return true;

  if (node.kind === 'univ') {
    if (
      node.univCodes.length > 0 &&
      node.univCodes.every((u) =>
        isUnivCovered(u, selectedKeys, node.deptsByUniv.get(u)),
      )
    ) {
      return true;
    }
  }

  if (node.kind === 'dept' || node.kind === 'univ-individual') {
    const univ = node.univCode!;
    const depts = node.memberDeptCodes ?? [];
    if (depts.length > 0 && depts.every((d) => selectedKeys.has(deptKey(univ, d)))) {
      return true;
    }
    if (node.kind === 'univ-individual' && selectedKeys.has(univ)) return true;
  }

  const children = allNodes.filter((n) => n.parentId === node.id);
  if (children.length === 0) return false;
  return children.every((c) => isFullyCovered(c, selectedKeys, allNodes));
}

/**
 * 위계통합(collapse)용 커버 판정.
 * - 노드가 직접 선택되었거나
 * - 개별 대학/학과 선택으로 해당 노드 전체가 채워졌거나
 * - (integrate 시) 직계 하위 위계가 모두 커버된 경우에만 true
 * 그룹의 memberUnivCodes를 selectedKeys에 넣지 않으므로,
 * 일부 지역만 골라도 상위 권역으로 잘못 승격되지 않는다.
 */
function isCollapseCovered(
  node: AggregatableNode,
  selectedKeys: Set<string>,
  allNodes: AggregatableNode[],
  integrate: boolean,
): boolean {
  if (selectedKeys.has(node.id)) return true;

  if (node.kind === 'dept' || node.kind === 'univ-individual') {
    const univ = node.univCode!;
    const depts = node.memberDeptCodes ?? [];
    if (depts.length > 0 && depts.every((d) => selectedKeys.has(deptKey(univ, d)))) {
      return true;
    }
    if (node.kind === 'univ-individual' && selectedKeys.has(univ)) return true;

    const children = allNodes.filter((n) => n.parentId === node.id);
    if (integrate && children.length > 0) {
      return children.every((c) =>
        isCollapseCovered(c, selectedKeys, allNodes, integrate),
      );
    }
    return false;
  }

  // kind === 'univ' (타대학 위계)
  const children = allNodes.filter((n) => n.parentId === node.id);
  if (children.length > 0) {
    if (!integrate) return false;
    return children.every((c) =>
      isCollapseCovered(c, selectedKeys, allNodes, integrate),
    );
  }

  // 하위 위계 노드가 없으면 소속 대학이 모두 개별 선택된 경우만
  return (
    node.univCodes.length > 0 &&
    node.univCodes.every((u) =>
      isUnivCovered(u, selectedKeys, node.deptsByUniv.get(u)),
    )
  );
}

export function toGroupTarget(node: AggregatableNode): SelectedTarget {
  if (node.kind === 'univ') {
    return {
      key: node.id,
      label: `${node.pathLabel} (평균)`,
      isYeonsung: false,
      mode: 'group',
      memberUnivCodes: node.memberUnivCodes,
    };
  }
  if (node.kind === 'univ-individual') {
    return {
      key: node.univCode!,
      label: node.label,
      isYeonsung: node.isYeonsung,
      mode: 'individual',
      univCode: node.univCode,
    };
  }
  return {
    key: node.id,
    label: `${node.pathLabel} (평균)`,
    isYeonsung: node.isYeonsung,
    mode: 'group',
    univCode: node.univCode,
    memberDeptCodes: node.memberDeptCodes,
  };
}

function normalizeYeonsungRoot(selected: SelectedTarget[]): SelectedTarget[] {
  return selected.map((s) => {
    if (s.key !== 'root:yeonsung' && !(s.mode === 'group' && s.key === 'root:yeonsung')) {
      return s;
    }
    // 자체 경쟁력: 대학 = 전 학과 평균 → 그룹 유지
    if (s.mode === 'group' && s.memberDeptCodes?.length) {
      return s;
    }
    const code = s.univCode;
    if (!code) return s;
    return {
      key: code,
      label: '연성대학교',
      isYeonsung: true,
      mode: 'individual' as const,
      univCode: code,
    };
  });
}

/**
 * 위계통합 ON: 하위 위계가 모두 선택된 경우만 상위 위계 평균으로 접기.
 * 위계통합 OFF: 선택한 위계 단위 그대로 유지 (상위로 승격하지 않음).
 */
export function collapseSelectedTargets(
  selected: SelectedTarget[],
  tree: TargetTreeNode[],
  integrate = false,
): SelectedTarget[] {
  if (!tree.length || !selected.length) return selected;

  if (!integrate) {
    return normalizeYeonsungRoot(selected);
  }

  // 직접 선택·개별 대학/학과만 키로 사용 (그룹 member 목록은 넣지 않음)
  const selectedKeys = new Set<string>();
  for (const s of selected) {
    selectedKeys.add(s.key);
    if (s.mode === 'individual' && s.univCode && !s.deptCode) {
      selectedKeys.add(s.univCode);
    }
    if (s.univCode && s.deptCode) {
      selectedKeys.add(deptKey(s.univCode, s.deptCode));
    }
  }

  const aggNodes = collectAggregatableNodes(tree).sort((a, b) => a.depth - b.depth);
  const consumedUnivs = new Set<string>();
  const consumedDepts = new Set<string>();
  const result: SelectedTarget[] = [];

  for (const node of aggNodes) {
    if (!isCollapseCovered(node, selectedKeys, aggNodes, true)) continue;

    if (node.kind === 'univ') {
      if (
        node.univCodes.length > 0 &&
        node.univCodes.every((u) => consumedUnivs.has(u))
      ) {
        continue;
      }
      if (node.univCodes.length === 0) continue;
      result.push(toGroupTarget(node));
      node.univCodes.forEach((u) => consumedUnivs.add(u));
      node.deptsByUniv.forEach((depts, u) => {
        depts.forEach((d) => consumedDepts.add(deptKey(u, d)));
      });
      continue;
    }

    const univ = node.univCode!;
    if (consumedUnivs.has(univ)) continue;
    const depts = node.memberDeptCodes ?? [];
    if (depts.length > 0 && depts.every((d) => consumedDepts.has(deptKey(univ, d)))) {
      continue;
    }

    result.push(toGroupTarget(node));
    if (node.kind === 'univ-individual' || node.id === 'root:yeonsung') {
      consumedUnivs.add(univ);
    }
    depts.forEach((d) => consumedDepts.add(deptKey(univ, d)));
  }

  for (const s of selected) {
    if (s.key === 'root:yeonsung' || (s.mode === 'group' && s.key === 'root:yeonsung')) {
      if (s.mode === 'group' && s.memberDeptCodes?.length) {
        if (result.some((r) => r.key === s.key)) continue;
        result.push(s);
        if (s.univCode) {
          s.memberDeptCodes.forEach((d) =>
            consumedDepts.add(deptKey(s.univCode!, d)),
          );
        }
        continue;
      }
      const code = s.univCode;
      if (code && !consumedUnivs.has(code)) {
        result.push({
          key: code,
          label: '연성대학교',
          isYeonsung: true,
          mode: 'individual',
          univCode: code,
        });
        consumedUnivs.add(code);
      }
      continue;
    }
    if (s.mode === 'group' || s.memberUnivCodes?.length || s.memberDeptCodes?.length) {
      if (result.some((r) => r.key === s.key)) continue;
      if (
        s.memberUnivCodes?.length &&
        s.memberUnivCodes.every((u) => consumedUnivs.has(u))
      ) {
        continue;
      }
      if (
        s.univCode &&
        s.memberDeptCodes?.length &&
        s.memberDeptCodes.every((d) =>
          consumedDepts.has(deptKey(s.univCode!, d)),
        )
      ) {
        continue;
      }
      // 상위로 흡수되지 않은 선택 그룹은 그대로 유지
      result.push(s);
      s.memberUnivCodes?.forEach((u) => consumedUnivs.add(u));
      if (s.univCode && s.memberDeptCodes?.length) {
        s.memberDeptCodes.forEach((d) =>
          consumedDepts.add(deptKey(s.univCode!, d)),
        );
      }
      continue;
    }
    if (!s.univCode) continue;
    if (consumedUnivs.has(s.univCode)) continue;
    if (s.deptCode && consumedDepts.has(deptKey(s.univCode, s.deptCode))) continue;
    result.push(s);
    if (s.deptCode) consumedDepts.add(deptKey(s.univCode, s.deptCode));
    else consumedUnivs.add(s.univCode);
  }

  return result;
}

export function findAggregatableNode(
  tree: TargetTreeNode[],
  nodeId: string,
): AggregatableNode | undefined {
  return collectAggregatableNodes(tree).find((n) => n.id === nodeId);
}

export function toIndividualTargetFromNode(node: TargetTreeNode): SelectedTarget {
  const key = node.deptCode
    ? `${node.univCode}::${node.deptCode}`
    : (node.univCode ?? node.id);
  return {
    key,
    univCode: node.univCode as string,
    deptCode: node.deptCode,
    label: node.label,
    isYeonsung: !!node.isYeonsung,
    mode: 'individual',
  };
}
