import { IrOrgChangeLog } from '../../entities';

type OrgFactKind = 'department' | 'series' | 'office' | 'category';
type OrgFactAction = 'create' | 'rename' | 'abolish';

export interface OrgAnnualFact {
  kind: OrgFactKind;
  action: OrgFactAction;
  label: string;
}

const DEPT_PREFIX = '[학과]';
const OFFICE_PREFIX = '[행정부서]';

function payloadName(payload: Record<string, unknown> | null | undefined): string {
  if (!payload) return '';
  const name = payload.name ?? payload.deptName ?? payload.seriesName;
  return String(name ?? '').trim();
}

function payloadIsCategory(
  payload: Record<string, unknown> | null | undefined,
): boolean {
  return Boolean(payload?.isCategory);
}

function nameChanged(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): boolean {
  const a = payloadName(before);
  const b = payloadName(after);
  return Boolean(a && b && a !== b);
}

export function factsFromLogs(logs: IrOrgChangeLog[]): OrgAnnualFact[] {
  const facts: OrgAnnualFact[] = [];
  for (const log of logs) {
    if (log.changeType === 'rollback') continue;
    const kind = log.kind as string;
    if (kind !== 'department' && kind !== 'series' && kind !== 'office') continue;

    if (log.changeType === 'create') {
      const isCat = kind === 'office' && payloadIsCategory(log.afterPayload);
      facts.push({
        kind: isCat ? 'category' : (kind as OrgFactKind),
        action: 'create',
        label: payloadName(log.afterPayload) || log.displayName,
      });
      continue;
    }
    if (log.changeType === 'abolish') {
      const isCat = kind === 'office' && payloadIsCategory(log.beforePayload);
      facts.push({
        kind: isCat ? 'category' : (kind as OrgFactKind),
        action: 'abolish',
        label: payloadName(log.beforePayload) || log.displayName,
      });
      continue;
    }
    if (log.changeType === 'update' && nameChanged(log.beforePayload, log.afterPayload)) {
      const isCat = kind === 'office' && payloadIsCategory(log.afterPayload);
      facts.push({
        kind: isCat ? 'category' : (kind as OrgFactKind),
        action: 'rename',
        label: payloadName(log.afterPayload) || log.displayName,
      });
    }
  }
  return facts.filter((f) => f.label);
}

function renameTag(kind: OrgFactKind): string {
  if (kind === 'department') return '학과명 변경';
  if (kind === 'series') return '계열명 변경';
  if (kind === 'category') return '대분류명 변경';
  return '부서명 변경';
}

function groupCreates(labels: string[], tag: string): string | null {
  const unique = [...new Set(labels.filter(Boolean))];
  if (unique.length === 0) return null;
  if (unique.length === 1) return `${unique[0]}(${tag})`;
  return `${unique.join(', ')} (${tag})`;
}

function formatKind(facts: OrgAnnualFact[], kind: OrgFactKind): string[] {
  const of = facts.filter((f) => f.kind === kind);
  const parts: string[] = [];
  const created = groupCreates(
    of.filter((f) => f.action === 'create').map((f) => f.label),
    '신설',
  );
  if (created) parts.push(created);
  for (const f of of.filter((f) => f.action === 'rename')) {
    parts.push(`${f.label}(${renameTag(kind)})`);
  }
  const abolished = groupCreates(
    of.filter((f) => f.action === 'abolish').map((f) => f.label),
    '폐지',
  );
  if (abolished) parts.push(abolished);
  return parts;
}

/** 학년도당 [연성대학교] 한 행 안에 학과/행정부서를 나눠 적는다. */
export function formatOrgAnnualContent(facts: OrgAnnualFact[]): string {
  const academic = [
    ...formatKind(facts, 'department'),
    ...formatKind(facts, 'series'),
  ];
  const admin = [
    ...formatKind(facts, 'office'),
    ...formatKind(facts, 'category'),
  ];
  const lines: string[] = [];
  if (academic.length > 0) {
    lines.push(`${DEPT_PREFIX} ${academic.join(' / ')}`);
  }
  if (admin.length > 0) {
    lines.push(`${OFFICE_PREFIX} ${admin.join(' / ')}`);
  }
  return lines.join('\n');
}

export function stripOrgAnnualSections(content: string): string {
  return content
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      return (
        Boolean(t) &&
        !t.startsWith(DEPT_PREFIX) &&
        !t.startsWith(OFFICE_PREFIX)
      );
    })
    .join('\n')
    .trim();
}

/** 관리자가 손본 문구는 남기고, [학과]/[행정부서] 구간만 조직관리 내용으로 교체한다. */
export function mergeOrgAnnualContent(
  existing: string,
  generated: string,
  previousAuto: string | null | undefined,
): string {
  const trimmed = existing.trim();
  const auto = (previousAuto ?? '').trim();
  const nextGenerated = generated.trim();
  if (!trimmed || trimmed === auto) return nextGenerated;

  let userPart = trimmed;
  if (auto) userPart = userPart.split(auto).join('');
  userPart = stripOrgAnnualSections(userPart)
    .replace(/\s*\/\s*$/g, '')
    .replace(/^\s*\/\s*/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();

  if (!nextGenerated) return userPart;
  if (!userPart) return nextGenerated;

  const userLabeled =
    userPart.includes(DEPT_PREFIX) || userPart.includes(OFFICE_PREFIX);
  const genHasDept = nextGenerated
    .split(/\r?\n/)
    .some((line) => line.trim().startsWith(DEPT_PREFIX));
  if (!userLabeled && !genHasDept) {
    userPart = `${DEPT_PREFIX} ${userPart.split(/\r?\n/).join(' / ')}`;
  }
  return `${userPart}\n${nextGenerated}`;
}
