/**
 * 모니터링 하위지표 자동계산식.
 * 저장 형식은 `{#metricId}`. 편집 화면에서는 `{지표명}` 으로 보여 준다.
 */

export class FormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormulaError';
  }
}

type FormulaAst =
  | { type: 'num'; value: number }
  | { type: 'ref'; id: number }
  | { type: 'unary'; op: '+' | '-'; arg: FormulaAst }
  | { type: 'bin'; op: '+' | '-' | '*' | '/'; left: FormulaAst; right: FormulaAst };

type Token =
  | { type: 'number'; value: number }
  | { type: 'ref'; id: number }
  | { type: 'name'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' }
  | { type: 'lparen' }
  | { type: 'rparen' };

export interface FormulaChild {
  metricId: number;
  metricName: string;
}

const CANON_REF = /\{#(\d+)\}/g;

function tokenize(input: string, allowNames: boolean): Token[] {
  const src = input.replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '');
  if (!src) throw new FormulaError('계산식을 입력해 주세요.');
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '{') {
      const close = src.indexOf('}', i + 1);
      if (close < 0) throw new FormulaError('중괄호가 닫히지 않았습니다.');
      const inner = src.slice(i + 1, close);
      if (inner.startsWith('#')) {
        const id = Number(inner.slice(1));
        if (!Number.isInteger(id) || id <= 0) {
          throw new FormulaError('지표 참조 형식이 올바르지 않습니다.');
        }
        tokens.push({ type: 'ref', id });
      } else if (allowNames) {
        const name = inner.trim();
        if (!name) throw new FormulaError('빈 지표 참조가 있습니다.');
        tokens.push({ type: 'name', value: name });
      } else {
        throw new FormulaError('지표는 {#숫자} 형식이어야 합니다.');
      }
      i = close + 1;
      continue;
    }
    if (ch >= '0' && ch <= '9') {
      let j = i + 1;
      while (j < src.length && src[j] >= '0' && src[j] <= '9') j += 1;
      if (src[j] === '.') {
        j += 1;
        const frac = j;
        while (j < src.length && src[j] >= '0' && src[j] <= '9') j += 1;
        if (j === frac) throw new FormulaError('숫자 형식이 올바르지 않습니다.');
      }
      tokens.push({ type: 'number', value: Number(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i += 1;
      continue;
    }
    throw new FormulaError(
      '사칙연산(+ - * /), 괄호, 숫자, 하위지표 참조만 사용할 수 있습니다.',
    );
  }
  return tokens;
}

function resolveNameTokens(tokens: Token[], children: FormulaChild[]): Token[] {
  return tokens.map((t) => {
    if (t.type !== 'name') return t;
    const exact = children.filter((c) => c.metricName === t.value);
    if (exact.length === 1) return { type: 'ref', id: exact[0].metricId };
    const loose = children.filter(
      (c) => c.metricName.replace(/\(학과별\)|\(학과\)$/g, '').trim() === t.value,
    );
    if (loose.length === 1) return { type: 'ref', id: loose[0].metricId };
    if (exact.length > 1 || loose.length > 1) {
      throw new FormulaError(`「${t.value}」 하위지표가 여러 개입니다.`);
    }
    throw new FormulaError(`「${t.value}」 하위지표를 찾을 수 없습니다.`);
  });
}

function parseTokens(tokens: Token[]): { ast: FormulaAst; refIds: number[] } {
  let pos = 0;
  const peek = (): Token | undefined => tokens[pos];
  const consume = (): Token => {
    const t = tokens[pos++];
    if (!t) throw new FormulaError('계산식이 끝나지 않았습니다.');
    return t;
  };
  const isOp = (
    t: Token | undefined,
    ops: string[],
  ): t is Extract<Token, { type: 'op' }> =>
    t?.type === 'op' && ops.includes(t.value);

  const parseExpr = (): FormulaAst => {
    let left = parseTerm();
    while (isOp(peek(), ['+', '-'])) {
      const op = consume() as Extract<Token, { type: 'op' }>;
      left = {
        type: 'bin',
        op: op.value as '+' | '-',
        left,
        right: parseTerm(),
      };
    }
    return left;
  };

  const parseTerm = (): FormulaAst => {
    let left = parseFactor();
    while (isOp(peek(), ['*', '/'])) {
      const op = consume() as Extract<Token, { type: 'op' }>;
      left = {
        type: 'bin',
        op: op.value as '*' | '/',
        left,
        right: parseFactor(),
      };
    }
    return left;
  };

  const parseFactor = (): FormulaAst => {
    const t = peek();
    if (!t) throw new FormulaError('계산식이 끝나지 않았습니다.');
    if (t.type === 'op' && (t.value === '+' || t.value === '-')) {
      consume();
      return { type: 'unary', op: t.value, arg: parseFactor() };
    }
    if (t.type === 'number') {
      consume();
      return { type: 'num', value: t.value };
    }
    if (t.type === 'ref') {
      consume();
      return { type: 'ref', id: t.id };
    }
    if (t.type === 'name') {
      throw new FormulaError('지표 이름을 해석하지 못했습니다.');
    }
    if (t.type === 'lparen') {
      consume();
      const inner = parseExpr();
      if (peek()?.type !== 'rparen') {
        throw new FormulaError('괄호가 닫히지 않았습니다.');
      }
      consume();
      return inner;
    }
    throw new FormulaError('계산식 형식이 올바르지 않습니다.');
  };

  const ast = parseExpr();
  if (pos !== tokens.length) {
    throw new FormulaError('계산식 형식이 올바르지 않습니다.');
  }

  const refIds: number[] = [];
  const walk = (node: FormulaAst) => {
    if (node.type === 'ref') refIds.push(node.id);
    else if (node.type === 'unary') walk(node.arg);
    else if (node.type === 'bin') {
      walk(node.left);
      walk(node.right);
    }
  };
  walk(ast);
  return { ast, refIds: [...new Set(refIds)] };
}

function evalAst(
  ast: FormulaAst,
  getValue: (id: number) => number,
): number | null {
  switch (ast.type) {
    case 'num':
      return ast.value;
    case 'ref':
      return getValue(ast.id);
    case 'unary': {
      const v = evalAst(ast.arg, getValue);
      if (v == null) return null;
      return ast.op === '-' ? -v : v;
    }
    case 'bin': {
      const l = evalAst(ast.left, getValue);
      const r = evalAst(ast.right, getValue);
      if (l == null || r == null) return null;
      if (ast.op === '+') return l + r;
      if (ast.op === '-') return l - r;
      if (ast.op === '*') return l * r;
      if (r === 0) return null;
      return l / r;
    }
    default:
      return null;
  }
}

export function parseDisplayFormula(
  input: string,
  children: FormulaChild[],
): { formula: string; refIds: number[] } {
  const tokens = resolveNameTokens(tokenize(input, true), children);
  const { ast, refIds } = parseTokens(tokens);
  if (refIds.length === 0) {
    throw new FormulaError('계산식에 하위지표를 하나 이상 넣어 주세요.');
  }
  const allowed = new Set(children.map((c) => c.metricId));
  const unknown = refIds.filter((id) => !allowed.has(id));
  if (unknown.length > 0) {
    throw new FormulaError('계산식에는 바로 아래 하위지표만 사용할 수 있습니다.');
  }
  const formula = serializeCanonical(ast);
  return { formula, refIds };
}

function serializeCanonical(ast: FormulaAst): string {
  switch (ast.type) {
    case 'num':
      return String(ast.value);
    case 'ref':
      return `{#${ast.id}}`;
    case 'unary':
      return ast.op === '-'
        ? `-(${serializeCanonical(ast.arg)})`
        : serializeCanonical(ast.arg);
    case 'bin': {
      const l = serializeCanonical(ast.left);
      const r = serializeCanonical(ast.right);
      const wrap = (node: FormulaAst, s: string) =>
        node.type === 'bin' &&
        (node.op === '+' || node.op === '-') &&
        (ast.op === '*' || ast.op === '/')
          ? `(${s})`
          : s;
      return `${wrap(ast.left, l)}${ast.op}${wrap(ast.right, r)}`;
    }
    default:
      return '';
  }
}

export function formulaToDisplay(
  canonical: string | null | undefined,
  children: FormulaChild[],
): string {
  if (!canonical) return '';
  const byId = new Map(children.map((c) => [c.metricId, c.metricName]));
  return canonical.replace(CANON_REF, (_, id: string) => {
    const name = byId.get(Number(id));
    return name ? `{${name}}` : `{#${id}}`;
  });
}

export function defaultSumDisplay(children: FormulaChild[]): string {
  if (children.length === 0) return '';
  return children.map((c) => `{${c.metricName}}`).join(' + ');
}

export function evaluateFormula(
  canonical: string,
  getValue: (metricId: number) => number | null,
): number | null {
  try {
    const { ast, refIds } = parseTokens(tokenize(canonical, false));
    if (refIds.length === 0) return null;
    const present = refIds.some((id) => getValue(id) != null);
    if (!present) return null;
    const result = evalAst(ast, (id) => getValue(id) ?? 0);
    if (result == null || !Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

export function extractFormulaRefIds(formula: string | null | undefined): number[] {
  if (!formula) return [];
  const ids: number[] = [];
  CANON_REF.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CANON_REF.exec(formula))) {
    ids.push(Number(m[1]));
  }
  return [...new Set(ids)];
}

export type AdditiveTerm = { metricId: number; coef: number };

export function analyzeFormula(canonical: string | null | undefined): {
  kind: 'additive' | 'other';
  terms: AdditiveTerm[];
  constant: number;
} {
  if (!canonical) return { kind: 'other', terms: [], constant: 0 };
  try {
    const { ast } = parseTokens(tokenize(canonical, false));
    const acc = {
      terms: new Map<number, number>(),
      constant: 0,
      ok: true,
    };
    collectAdditive(ast, 1, acc);
    if (!acc.ok) return { kind: 'other', terms: [], constant: 0 };
    const terms = [...acc.terms.entries()]
      .filter(([, coef]) => coef !== 0)
      .map(([metricId, coef]) => ({ metricId, coef }));
    if (terms.length === 0) return { kind: 'other', terms: [], constant: 0 };
    return { kind: 'additive', terms, constant: acc.constant };
  } catch {
    return { kind: 'other', terms: [], constant: 0 };
  }
}

function collectAdditive(
  ast: FormulaAst,
  sign: number,
  acc: { terms: Map<number, number>; constant: number; ok: boolean },
): void {
  if (!acc.ok) return;
  switch (ast.type) {
    case 'num':
      acc.constant += sign * ast.value;
      return;
    case 'ref':
      acc.terms.set(ast.id, (acc.terms.get(ast.id) ?? 0) + sign);
      return;
    case 'unary':
      collectAdditive(ast.arg, ast.op === '-' ? -sign : sign, acc);
      return;
    case 'bin':
      if (ast.op === '*' || ast.op === '/') {
        acc.ok = false;
        return;
      }
      collectAdditive(ast.left, sign, acc);
      collectAdditive(ast.right, ast.op === '-' ? -sign : sign, acc);
  }
}
