import { TargetTreeNode } from '../universities/universities.service';
import { PivotTargetDto } from './pivot.dto';

type GroupKind = 'univ' | 'dept' | 'univ-individual';

interface AggNode {
  id: string;
  parentId?: string;
  pathLabel: string;
  depth: number;
  kind: GroupKind;
  isYeonsung: boolean;
  univCode?: string;
  memberUnivCodes?: string[];
  memberDeptCodes?: string[];
  /** 이 노드가 커버하는 대학 코드들 */
  univCodes: string[];
  /** 대학별 학과 코드 (dept 그룹/대학 접기용) */
  deptsByUniv: Map<string, string[]>;
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

function isUnivGroup(node: TargetTreeNode) {
  if (node.isYeonsung && node.level === 'root') return false;
  return ['root', 'schoolType', 'region', 'regionCity'].includes(node.level);
}

function isDeptGroup(node: TargetTreeNode) {
  return node.level === 'series';
}

function isYeonsungRoot(node: TargetTreeNode) {
  return !!node.isYeonsung && node.level === 'root' && !!node.univCode;
}

function walk(
  node: TargetTreeNode,
  depth: number,
  parentPath: string,
  ancestorUniv: string | undefined,
  ancestorYeonsung: boolean,
  out: AggNode[],
  parentId?: string,
) {
  const univCode = node.univCode ?? ancestorUniv;
  const isYeonsung = !!(node.isYeonsung || ancestorYeonsung);
  // parentPath는 부모가 이미 이 노드 label까지 포함한 전체 경로
  const currentPath = parentPath;
  let selfId: string | undefined;

  if (isUnivGroup(node)) {
    const memberUnivCodes = collectUnivCodes(node);
    const depts = collectDepts(node);
    const deptsByUniv = new Map<string, string[]>();
    depts.forEach(({ univCode: u, deptCode }) => {
      if (!deptsByUniv.has(u)) deptsByUniv.set(u, []);
      deptsByUniv.get(u)!.push(deptCode);
    });
    selfId = node.id;
    out.push({
      id: node.id,
      parentId,
      pathLabel: currentPath,
      depth,
      kind: 'univ',
      isYeonsung: false,
      memberUnivCodes,
      univCodes: memberUnivCodes,
      deptsByUniv,
    });
  } else if (isYeonsungRoot(node) && node.univCode) {
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
      pathLabel: currentPath,
      depth,
      kind: fromNode.length > 0 ? 'dept' : 'univ-individual',
      isYeonsung: true,
      univCode: node.univCode,
      memberDeptCodes,
      univCodes: [node.univCode],
      deptsByUniv: new Map([[node.univCode, memberDeptCodes]]),
    });
  } else if (isDeptGroup(node) && univCode) {
    const depts = collectDepts(node, univCode);
    if (depts.length > 0) {
      const memberDeptCodes = depts.map((d) => d.deptCode);
      const deptsByUniv = new Map<string, string[]>([[univCode, memberDeptCodes]]);
      selfId = node.id;
      out.push({
        id: node.id,
        parentId,
        pathLabel: currentPath,
        depth,
        kind: 'dept',
        isYeonsung,
        univCode,
        memberDeptCodes,
        univCodes: [univCode],
        deptsByUniv,
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
      pathLabel: currentPath,
      depth,
      kind: 'univ-individual',
      isYeonsung: false,
      univCode: node.univCode,
      memberDeptCodes,
      univCodes: [node.univCode],
      deptsByUniv: new Map([[node.univCode, memberDeptCodes]]),
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
    walk(
      child,
      depth + 1,
      childPath,
      node.univCode ?? ancestorUniv,
      isYeonsung,
      out,
      selfId ?? parentId,
    );
  });
}

function buildAggNodes(tree: TargetTreeNode[]): AggNode[] {
  const out: AggNode[] = [];
  tree.forEach((root) =>
    walk(root, 0, root.label, root.univCode, !!root.isYeonsung, out),
  );
  return out.sort((a, b) => a.depth - b.depth);
}

/** 선택 키: 그룹 키·개별 대학/학과만 (member 목록은 넣지 않음) */
function selectionKeys(targets: PivotTargetDto[]): Set<string> {
  const keys = new Set<string>();
  for (const t of targets) {
    if (t.groupKey) keys.add(t.groupKey);
    if (t.univCode && t.deptCode) keys.add(deptKey(t.univCode, t.deptCode));
    else if (t.univCode && !t.groupKey) keys.add(t.univCode);
  }
  return keys;
}

function isUnivCovered(
  univCode: string,
  keys: Set<string>,
  depts: string[] | undefined,
): boolean {
  if (keys.has(univCode)) return true;
  if (depts && depts.length > 0) {
    return depts.every((d) => keys.has(deptKey(univCode, d)));
  }
  return false;
}

/** 위계통합용: 직계 하위가 모두 커버된 경우에만 상위 승격 */
function isCollapseCovered(
  node: AggNode,
  keys: Set<string>,
  all: AggNode[],
  integrate: boolean,
): boolean {
  if (keys.has(node.id)) return true;

  if (node.kind === 'dept' || node.kind === 'univ-individual') {
    const univ = node.univCode!;
    const depts = node.memberDeptCodes ?? [];
    if (depts.length > 0 && depts.every((d) => keys.has(deptKey(univ, d)))) {
      return true;
    }
    if (node.kind === 'univ-individual' && keys.has(univ)) return true;

    const children = all.filter((n) => n.parentId === node.id);
    if (integrate && children.length > 0) {
      return children.every((c) => isCollapseCovered(c, keys, all, integrate));
    }
    return false;
  }

  const children = all.filter((n) => n.parentId === node.id);
  if (children.length > 0) {
    if (!integrate) return false;
    return children.every((c) => isCollapseCovered(c, keys, all, integrate));
  }

  return (
    node.univCodes.length > 0 &&
    node.univCodes.every((u) => isUnivCovered(u, keys, node.deptsByUniv.get(u)))
  );
}

function toDto(node: AggNode): PivotTargetDto {
  if (node.kind === 'univ') {
    return {
      groupKey: node.id,
      groupLabel: `${node.pathLabel} (평균)`,
      memberUnivCodes: node.memberUnivCodes,
      isYeonsung: false,
    };
  }
  if (node.kind === 'univ-individual') {
    return {
      univCode: node.univCode,
      isYeonsung: node.isYeonsung,
    };
  }
  // 공시 대시보드: 연성대 root는 대학 1행. 자체 경쟁력(전 학과 평균)은 유지.
  if (node.id === 'root:yeonsung' && node.univCode && !node.memberDeptCodes?.length) {
    return {
      univCode: node.univCode,
      isYeonsung: true,
    };
  }
  return {
    groupKey: node.id,
    groupLabel: `${node.pathLabel} (평균)`,
    univCode: node.univCode,
    memberDeptCodes: node.memberDeptCodes,
    isYeonsung: node.isYeonsung,
  };
}

/**
 * 위계통합 ON: 하위 위계가 모두 선택된 경우만 상위 평균으로 접기.
 * 위계통합 OFF: 요청 대상 그대로 유지.
 */
export function collapsePivotTargets(
  targets: PivotTargetDto[],
  tree: TargetTreeNode[],
  integrate = false,
): PivotTargetDto[] {
  if (!targets?.length || !tree?.length) return targets;

  if (!integrate) {
    return targets.map((t) => {
      // 전 학과 평균(자체 경쟁력)은 대학 단위(_ALL_)로 접지 않음
      if (
        t.groupKey === 'root:yeonsung' &&
        t.univCode &&
        !t.memberDeptCodes?.length
      ) {
        return { univCode: t.univCode, isYeonsung: true };
      }
      return t;
    });
  }

  const keys = selectionKeys(targets);
  const nodes = buildAggNodes(tree);
  const consumedUnivs = new Set<string>();
  const consumedDepts = new Set<string>();
  const result: PivotTargetDto[] = [];

  for (const node of nodes) {
    if (!isCollapseCovered(node, keys, nodes, true)) continue;

    if (node.kind === 'univ') {
      if (
        node.univCodes.length > 0 &&
        node.univCodes.every((u) => consumedUnivs.has(u))
      ) {
        continue;
      }
      if (node.univCodes.length === 0) continue;
      result.push(toDto(node));
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

    result.push(toDto(node));
    if (node.kind === 'univ-individual' || node.id === 'root:yeonsung') {
      consumedUnivs.add(univ);
    }
    depts.forEach((d) => consumedDepts.add(deptKey(univ, d)));
  }

  for (const t of targets) {
    if (t.groupKey === 'root:yeonsung') {
      if (t.memberDeptCodes?.length) {
        if (result.some((r) => r.groupKey === t.groupKey)) continue;
        result.push(t);
        if (t.univCode) {
          t.memberDeptCodes.forEach((d) =>
            consumedDepts.add(deptKey(t.univCode!, d)),
          );
        }
        continue;
      }
      const code = t.univCode;
      if (code && consumedUnivs.has(code)) continue;
      if (code && !consumedUnivs.has(code)) {
        result.push({ univCode: code, isYeonsung: true });
        consumedUnivs.add(code);
      }
      continue;
    }
    if (t.groupKey) {
      if (result.some((r) => r.groupKey === t.groupKey)) continue;
      if (
        t.memberUnivCodes?.length &&
        t.memberUnivCodes.every((u) => consumedUnivs.has(u))
      ) {
        continue;
      }
      if (
        t.univCode &&
        t.memberDeptCodes?.length &&
        t.memberDeptCodes.every((d) =>
          consumedDepts.has(deptKey(t.univCode!, d)),
        )
      ) {
        continue;
      }
      // 상위로 흡수되지 않은 선택 그룹 유지
      result.push(t);
      t.memberUnivCodes?.forEach((u) => consumedUnivs.add(u));
      if (t.univCode && t.memberDeptCodes?.length) {
        t.memberDeptCodes.forEach((d) =>
          consumedDepts.add(deptKey(t.univCode!, d)),
        );
      }
      continue;
    }
    if (!t.univCode) continue;
    if (consumedUnivs.has(t.univCode)) continue;
    if (t.deptCode && consumedDepts.has(deptKey(t.univCode, t.deptCode))) continue;
    result.push(t);
    if (t.deptCode) consumedDepts.add(deptKey(t.univCode, t.deptCode));
    else consumedUnivs.add(t.univCode);
  }

  return result;
}
