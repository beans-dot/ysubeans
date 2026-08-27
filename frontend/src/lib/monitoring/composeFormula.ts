import type { FormulaEvalNode, HierarchyValues, YearValueMap } from './types';
import { emptyYearMap } from './composeStudentCount';
import { evaluateFormula, extractFormulaRefIds } from './formula';
import type { MetricNode } from '@/lib/api';

export function toFormulaEvalNode(node: MetricNode): FormulaEvalNode {
  return {
    metricId: node.metricId,
    name: node.metricName,
    computeEnabled: !!node.computeEnabled,
    computeFormula: node.computeFormula ?? null,
    children: (node.children ?? []).map(toFormulaEvalNode),
  };
}

export function collectFormulaMetricIds(node: FormulaEvalNode): number[] {
  const ids = new Set<number>([node.metricId]);
  const walk = (n: FormulaEvalNode) => {
    ids.add(n.metricId);
    extractFormulaRefIds(n.computeFormula).forEach((id) => ids.add(id));
    n.children.forEach(walk);
  };
  walk(node);
  return Array.from(ids);
}

function findDirectChild(
  node: FormulaEvalNode,
  metricId: number,
): FormulaEvalNode | undefined {
  return node.children.find((c) => c.metricId === metricId);
}

function readRaw(
  rawById: Map<number, HierarchyValues>,
  metricId: number,
  year: number,
  deptCode: string | null,
): number | null {
  const h = rawById.get(metricId);
  if (!h) return null;
  if (deptCode) return h.depts[deptCode]?.[year] ?? null;
  return h.univ[year] ?? null;
}

function valueAt(
  node: FormulaEvalNode,
  rawById: Map<number, HierarchyValues>,
  year: number,
  deptCode: string | null,
): number | null {
  const raw = readRaw(rawById, node.metricId, year, deptCode);
  if (node.computeEnabled && node.computeFormula) {
    const computed = evaluateFormula(node.computeFormula, (id) => {
      const child = findDirectChild(node, id);
      if (child) return valueAt(child, rawById, year, deptCode);
      return readRaw(rawById, id, year, deptCode);
    });
    if (computed != null) return computed;
  }
  return raw;
}

function mapYears(
  node: FormulaEvalNode,
  rawById: Map<number, HierarchyValues>,
  years: number[],
  deptCode: string | null,
): YearValueMap {
  const out = emptyYearMap(years);
  for (const year of years) {
    out[year] = valueAt(node, rawById, year, deptCode);
  }
  return out;
}

export function composeFormulaHierarchy(
  node: FormulaEvalNode,
  rawById: Map<number, HierarchyValues>,
  years: number[],
  deptCodes: string[],
): HierarchyValues {
  return {
    univ: mapYears(node, rawById, years, null),
    depts: Object.fromEntries(
      deptCodes.map((code) => [code, mapYears(node, rawById, years, code)]),
    ),
  };
}

export function formulaChildHierarchies(
  node: FormulaEvalNode,
  rawById: Map<number, HierarchyValues>,
  years: number[],
  deptCodes: string[],
): { metricId: number; name: string; values: HierarchyValues }[] {
  return node.children.map((child) => ({
    metricId: child.metricId,
    name: child.name,
    values: composeFormulaHierarchy(child, rawById, years, deptCodes),
  }));
}

export function composeAdditiveHierarchy(
  terms: { metricId: number; coef: number }[],
  constant: number,
  children: Map<number, HierarchyValues>,
  years: number[],
  deptCodes: string[],
): HierarchyValues {
  const combine = (deptCode: string | null): YearValueMap => {
    const out = emptyYearMap(years);
    for (const year of years) {
      const parts = terms.map((term) => {
        const h = children.get(term.metricId);
        const raw = deptCode
          ? (h?.depts[deptCode]?.[year] ?? null)
          : (h?.univ[year] ?? null);
        return raw;
      });
      if (parts.every((v) => v == null) && constant === 0) {
        out[year] = null;
      } else {
        out[year] =
          constant +
          terms.reduce((sum, term, i) => {
            const raw = parts[i];
            if (raw == null) return sum;
            return sum + term.coef * raw;
          }, 0);
      }
    }
    return out;
  };

  const depts: Record<string, YearValueMap> = Object.fromEntries(
    deptCodes.map((code) => [code, combine(code)]),
  );
  const univ = combine(null);
  const filled = { ...univ };
  const maps = Object.values(depts);
  for (const year of years) {
    if (filled[year] != null) continue;
    const nums = maps
      .map((m) => m[year])
      .filter((v): v is number => v != null);
    filled[year] = nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0);
  }
  return { univ: filled, depts };
}
