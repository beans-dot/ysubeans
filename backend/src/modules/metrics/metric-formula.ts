/**
 * 모니터링 하위지표 자동계산식.
 * 토큰은 `{#metricId}` 이고 사칙연산·괄호·숫자 리터럴만 허용한다.
 */

type FormulaAst =
  | { type: 'num'; value: number }
  | { type: 'ref'; id: number }
  | { type: 'unary'; op: '+' | '-'; arg: FormulaAst }
  | { type: 'bin'; op: '+' | '-' | '*' | '/'; left: FormulaAst; right: FormulaAst };

type Token =
  | { type: 'number'; value: number }
  | { type: 'ref'; id: number }
  | { type: 'op'; value: '+' | '-' | '*' | '/' }
  | { type: 'lparen' }
  | { type: 'rparen' };

export class FormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormulaError';
  }
}

function tokenize(input: string): Token[] {
  const src = input.replace(/\s+/g, '');
  if (!src) throw new FormulaError('계산식을 입력해 주세요.');
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '{') {
      if (src[i + 1] !== '#') {
        throw new FormulaError('지표는 {#숫자} 형식이어야 합니다.');
      }
      let j = i + 2;
      while (j < src.length && src[j] >= '0' && src[j] <= '9') j += 1;
      if (j === i + 2 || src[j] !== '}') {
        throw new FormulaError('지표 참조 형식이 올바르지 않습니다.');
      }
      tokens.push({ type: 'ref', id: Number(src.slice(i + 2, j)) });
      i = j + 1;
      continue;
    }
    if (ch >= '0' && ch <= '9') {
      let j = i + 1;
      while (j < src.length && src[j] >= '0' && src[j] <= '9') j += 1;
      if (src[j] === '.') {
        j += 1;
        const startFrac = j;
        while (j < src.length && src[j] >= '0' && src[j] <= '9') j += 1;
        if (j === startFrac) throw new FormulaError('숫자 형식이 올바르지 않습니다.');
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
    throw new FormulaError('사칙연산(+ - * /), 괄호, 숫자, 하위지표 참조만 사용할 수 있습니다.');
  }
  return tokens;
}

function parseTokens(tokens: Token[]): { ast: FormulaAst; refIds: number[] } {
  let pos = 0;
  const peek = (): Token | undefined => tokens[pos];
  const consume = (): Token => {
    const t = tokens[pos++];
    if (!t) throw new FormulaError('계산식이 끝나지 않았습니다.');
    return t;
  };
  const isOp = (t: Token | undefined, ops: string[]): t is Extract<Token, { type: 'op' }> =>
    t?.type === 'op' && ops.includes(t.value);

  const parseExpr = (): FormulaAst => {
    let left = parseTerm();
    while (isOp(peek(), ['+', '-'])) {
      const op = consume() as Extract<Token, { type: 'op' }>;
      left = { type: 'bin', op: op.value as '+' | '-', left, right: parseTerm() };
    }
    return left;
  };

  const parseTerm = (): FormulaAst => {
    let left = parseFactor();
    while (isOp(peek(), ['*', '/'])) {
      const op = consume() as Extract<Token, { type: 'op' }>;
      left = { type: 'bin', op: op.value as '*' | '/', left, right: parseFactor() };
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
    if (t.type === 'lparen') {
      consume();
      const inner = parseExpr();
      if (peek()?.type !== 'rparen') throw new FormulaError('괄호가 닫히지 않았습니다.');
      consume();
      return inner;
    }
    throw new FormulaError('계산식 형식이 올바르지 않습니다.');
  };

  const ast = parseExpr();
  if (pos !== tokens.length) throw new FormulaError('계산식 형식이 올바르지 않습니다.');

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

function parseMetricFormula(formula: string): {
  ast: FormulaAst;
  refIds: number[];
} {
  return parseTokens(tokenize(formula));
}

export function validateMetricFormula(
  formula: string,
  allowedChildIds: number[],
): { refIds: number[] } {
  const { refIds } = parseMetricFormula(formula);
  if (refIds.length === 0) {
    throw new FormulaError('계산식에 하위지표를 하나 이상 넣어 주세요.');
  }
  const allowed = new Set(allowedChildIds);
  const unknown = refIds.filter((id) => !allowed.has(id));
  if (unknown.length > 0) {
    throw new FormulaError(
      '계산식에는 바로 아래 하위지표만 사용할 수 있습니다.',
    );
  }
  return { refIds };
}

/** 시드 재학생·회계처럼 화면 계산이 고정된 지표는 관리자 계산식을 받지 않는다. */
export function isLockedAutoComputeMetric(metricCode?: string | null): boolean {
  if (!metricCode) return false;
  if (metricCode === 'student-count') return true;
  if (
    metricCode === 'tuition-accounting' ||
    metricCode === 'corporate-accounting' ||
    metricCode === 'iacf-accounting'
  ) {
    return true;
  }
  return metricCode.endsWith('.income') || metricCode.endsWith('.expense');
}
