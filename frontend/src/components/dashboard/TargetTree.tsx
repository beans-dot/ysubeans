'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { api, type TargetTreeNode } from '@/lib/api';
import {
  collectAggregatableNodes,
  findAggregatableNode,
  isFullyCovered,
  toGroupTarget,
  toIndividualTargetFromNode,
  type AggregatableNode,
} from '@/lib/targetSelection';
import { cn } from '@/lib/utils';
import { useDashboardStore, type SelectedTarget } from '@/store/useDashboardStore';
import { Checkbox } from '@/components/ui/checkbox';

/** 스토어 트리와 무관하게 현재 노드에서 바로 그룹 대상 생성 */
function buildGroupFromNode(
  node: TargetTreeNode,
  pathLabel: string,
  ancestorUnivCode?: string,
  ancestorIsYeonsung?: boolean,
): { target: SelectedTarget; descendantKeys: string[] } | null {
  const univCode = node.univCode ?? ancestorUnivCode;
  const isYeonsung = !!(node.isYeonsung || ancestorIsYeonsung);

  const collectDepts = (n: TargetTreeNode, u?: string): string[] => {
    const out: string[] = [];
    const walk = (x: TargetTreeNode, uu?: string) => {
      const code = x.univCode ?? uu;
      if (x.level === 'dept' && x.deptCode && code) out.push(x.deptCode);
      x.children?.forEach((c) => walk(c, x.univCode ?? uu));
    };
    walk(n, u);
    return out;
  };

  const collectUnivs = (n: TargetTreeNode): string[] => {
    const codes = new Set<string>();
    const walk = (x: TargetTreeNode) => {
      if (x.level === 'univ' && x.univCode) codes.add(x.univCode);
      x.children?.forEach(walk);
    };
    walk(n);
    return Array.from(codes);
  };

  const collectKeys = (n: TargetTreeNode, u?: string): string[] => {
    const keys = new Set<string>([n.id]);
    const walk = (x: TargetTreeNode, uu?: string) => {
      keys.add(x.id);
      const code = x.univCode ?? uu;
      if (x.level === 'dept' && x.deptCode && code) {
        keys.add(`${code}::${x.deptCode}`);
      }
      if (x.level === 'univ' && x.univCode) keys.add(x.univCode);
      x.children?.forEach((c) => walk(c, x.univCode ?? uu));
    };
    walk(n, u);
    return Array.from(keys);
  };

  // 타대학 상위 위계
  if (
    !(node.isYeonsung && node.level === 'root') &&
    ['root', 'schoolType', 'region', 'regionCity'].includes(node.level)
  ) {
    const memberUnivCodes = collectUnivs(node);
    if (memberUnivCodes.length === 0) return null;
    return {
      target: {
        key: node.id,
        label: `${pathLabel} (평균)`,
        isYeonsung: false,
        mode: 'group',
        memberUnivCodes,
      },
      descendantKeys: collectKeys(node),
    };
  }

  // 연성대 root → 대학 단위 1개 (평균 라벨/중복 행 방지)
  if (node.isYeonsung && node.level === 'root' && univCode) {
    return {
      target: {
        key: univCode,
        label: node.label,
        isYeonsung: true,
        mode: 'individual',
        univCode,
      },
      descendantKeys: collectKeys(node, univCode),
    };
  }

  // 계열 → 소속 학과 평균
  if (node.level === 'series') {
    if (!univCode) return null;
    const memberDeptCodes = collectDepts(node, univCode);
    if (memberDeptCodes.length === 0) return null;
    return {
      target: {
        key: node.id,
        label: `${pathLabel} (평균)`,
        isYeonsung: !!(node.isYeonsung || isYeonsung),
        mode: 'group',
        univCode,
        memberDeptCodes,
      },
      descendantKeys: collectKeys(node, univCode),
    };
  }

  return null;
}

function TreeNode({
  node,
  depth,
  pathLabel,
  ancestorUnivCode,
  ancestorIsYeonsung,
}: {
  node: TargetTreeNode;
  depth: number;
  pathLabel: string;
  ancestorUnivCode?: string;
  ancestorIsYeonsung?: boolean;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const tree = useDashboardStore((s) => s.targetTree);
  const selectedTargets = useDashboardStore((s) => s.selectedTargets);
  const toggleHierarchyGroup = useDashboardStore((s) => s.toggleHierarchyGroup);
  const toggleIndividualTarget = useDashboardStore((s) => s.toggleIndividualTarget);

  const hasChildren = !!node.children && node.children.length > 0;
  const isDept = node.level === 'dept';
  const isUniv = node.level === 'univ';
  const isYeonsungRoot = !!node.isYeonsung && node.level === 'root';

  const localGroup = useMemo(
    () => buildGroupFromNode(node, pathLabel, ancestorUnivCode, ancestorIsYeonsung),
    [node, pathLabel, ancestorUnivCode, ancestorIsYeonsung],
  );

  const aggNode = useMemo(
    () => findAggregatableNode(tree, node.id),
    [tree, node.id],
  );
  const hierarchyNode: AggregatableNode | undefined =
    aggNode && aggNode.kind !== 'univ-individual' ? aggNode : undefined;

  const selectedKeys = useMemo(
    () => new Set(selectedTargets.map((t) => t.key)),
    [selectedTargets],
  );

  const aggNodes = useMemo(() => collectAggregatableNodes(tree), [tree]);

  const checkState: boolean | 'indeterminate' = (() => {
    if (localGroup || hierarchyNode) {
      const id = localGroup?.target.key ?? hierarchyNode!.id;
      if (selectedKeys.has(id)) return true;
      if (hierarchyNode && isFullyCovered(hierarchyNode, selectedKeys, aggNodes)) {
        return true;
      }
      // 하위 일부 선택
      if (hierarchyNode) {
        const covered = hierarchyNode.leafKeys.filter((k) => selectedKeys.has(k)).length;
        if (covered > 0) return 'indeterminate';
      }
      if (localGroup) {
        const keys = localGroup.descendantKeys.filter((k) => k !== id);
        if (keys.some((k) => selectedKeys.has(k))) return 'indeterminate';
      }
      return false;
    }
    if (isUniv) {
      const key = node.univCode ?? node.id;
      if (selectedKeys.has(key)) return true;
      if (aggNode && isFullyCovered(aggNode, selectedKeys, aggNodes)) return true;
      if (aggNode) {
        const covered = aggNode.leafKeys.filter((k) => selectedKeys.has(k)).length;
        if (covered > 0) return 'indeterminate';
      }
      return false;
    }
    if (isDept && node.selectable && node.univCode && node.deptCode) {
      return selectedKeys.has(`${node.univCode}::${node.deptCode}`);
    }
    return false;
  })();

  const canToggle =
    !!localGroup ||
    !!hierarchyNode ||
    ((isUniv || isYeonsungRoot) && !!node.univCode) ||
    (isDept && !!node.selectable && !!node.univCode);

  const onToggle = (e?: Event) => {
    e?.preventDefault?.();
    // 위계 그룹: 학과/대학을 펼치지 않고 평균 1개만 선택
    if (localGroup) {
      toggleHierarchyGroup(localGroup.target, localGroup.descendantKeys);
      return;
    }
    if (hierarchyNode) {
      toggleHierarchyGroup(toGroupTarget(hierarchyNode), hierarchyNode.descendantKeys);
      return;
    }
    if (isUniv && node.univCode) {
      toggleIndividualTarget(toIndividualTargetFromNode(node), [
        node.id,
        node.univCode,
      ]);
      return;
    }
    if (isDept && node.selectable && node.univCode) {
      toggleIndividualTarget(toIndividualTargetFromNode(node), []);
    }
  };

  const isGroupNode =
    localGroup?.target.mode === 'group' ||
    (!!hierarchyNode && hierarchyNode.kind !== 'univ-individual');

  return (
    <div>
      <div
        className="flex items-center gap-1 rounded px-1 py-1 hover:bg-accent"
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-muted-foreground"
            aria-label={expanded ? '접기' : '펼치기'}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={checkState}
            onCheckedChange={() => onToggle()}
            disabled={!canToggle}
          />
          <span
            className={cn(
              (node.isYeonsung || ancestorIsYeonsung) && 'font-bold text-primary',
              !node.selectable && depth === 0 && 'font-bold',
            )}
          >
            {node.label}
            {isGroupNode && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                평균
              </span>
            )}
          </span>
        </label>
      </div>

      {expanded &&
        node.children?.map((child) => {
          const nextPath = (() => {
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
          })();
          return (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              pathLabel={nextPath}
              ancestorUnivCode={node.univCode ?? ancestorUnivCode}
              ancestorIsYeonsung={!!node.isYeonsung || !!ancestorIsYeonsung}
            />
          );
        })}
    </div>
  );
}

export function TargetTree() {
  const [tree, setTree] = useState<TargetTreeNode[]>([]);
  const [loaded, setLoaded] = useState(false);
  const setTargetTree = useDashboardStore((s) => s.setTargetTree);

  useEffect(() => {
    api
      .get<TargetTreeNode[]>('/universities/tree')
      .then(({ data }) => {
        setTree(data);
        setTargetTree(data);
      })
      .catch(() => {
        setTree([]);
        setTargetTree([]);
      })
      .finally(() => setLoaded(true));
  }, [setTargetTree]);

  return (
    <div className="max-h-[420px] overflow-y-auto rounded-md border p-2">
      {!loaded && (
        <p className="p-2 text-sm text-muted-foreground">불러오는 중...</p>
      )}
      {loaded && tree.length === 0 && (
        <p className="p-2 text-sm text-muted-foreground">
          대상 데이터가 없습니다. 시딩 또는 업로드 후 이용하세요.
        </p>
      )}
      {tree.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          pathLabel={node.label}
          ancestorUnivCode={node.univCode}
          ancestorIsYeonsung={!!node.isYeonsung}
        />
      ))}
    </div>
  );
}
