export type CellValue = number | string | boolean | CellError;

export interface CellError {
  type: 'REF' | 'CIRC' | 'DIV0' | 'VALUE' | 'NAME';
  message: string;
}

export function isCellError(v: CellValue): v is CellError {
  return typeof v === 'object' && v !== null && 'type' in v && 'message' in v;
}

export class SpreadsheetError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'SpreadsheetError';
  }
}

// ==================== Parsing ====================

type Expr =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'ref'; ref: string }
  | { kind: 'range'; from: string; to: string }
  | { kind: 'binop'; op: string; left: Expr; right: Expr }
  | { kind: 'unary'; op: string; expr: Expr }
  | { kind: 'call'; name: string; args: Expr[] };

const REF_RE = /^[A-Z]{1,2}[1-9][0-9]{0,2}$/;

function normalizeRef(ref: string): string {
  return ref.toUpperCase();
}

function validateRef(ref: string): void {
  const upper = normalizeRef(ref);
  if (!REF_RE.test(upper)) {
    throw new SpreadsheetError(`Invalid cell reference: ${ref}`);
  }
}

function parseRef(ref: string): { col: number; row: number } {
  const upper = normalizeRef(ref);
  const match = upper.match(/^([A-Z]{1,2})(\d+)$/);
  if (!match) throw new SpreadsheetError(`Invalid ref: ${ref}`);
  const colStr = match[1];
  const row = parseInt(match[2], 10);
  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64);
  }
  return { col, row };
}

function refFromColRow(col: number, row: number): string {
  let colStr = '';
  let c = col;
  while (c > 0) {
    const rem = ((c - 1) % 26);
    colStr = String.fromCharCode(65 + rem) + colStr;
    c = Math.floor((c - 1) / 26);
  }
  return `${colStr}${row}`;
}

function expandRange(from: string, to: string): string[] {
  const f = parseRef(from);
  const t = parseRef(to);
  const refs: string[] = [];
  const minRow = Math.min(f.row, t.row);
  const maxRow = Math.max(f.row, t.row);
  const minCol = Math.min(f.col, t.col);
  const maxCol = Math.max(f.col, t.col);
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      refs.push(refFromColRow(c, r));
    }
  }
  return refs;
}

// Simple recursive descent parser for formulas
class Parser {
  private pos = 0;
  private input: string;

  constructor(input: string) {
    this.input = input;
  }

  parse(): Expr {
    const expr = this.parseComparison();
    if (this.pos < this.input.length) {
      throw new Error(`Unexpected character at position ${this.pos}: '${this.input[this.pos]}'`);
    }
    return expr;
  }

  private peek(): string {
    this.skipWhitespace();
    return this.input[this.pos] ?? '';
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length && this.input[this.pos] === ' ') {
      this.pos++;
    }
  }

  private parseComparison(): Expr {
    let left = this.parseAddSub();
    while (true) {
      this.skipWhitespace();
      if (this.pos < this.input.length) {
        const twoChar = this.input.slice(this.pos, this.pos + 2);
        if (twoChar === '>=' || twoChar === '<=' || twoChar === '<>') {
          this.pos += 2;
          const right = this.parseAddSub();
          left = { kind: 'binop', op: twoChar, left, right };
          continue;
        }
        const oneChar = this.input[this.pos];
        if (oneChar === '>' || oneChar === '<' || oneChar === '=') {
          this.pos += 1;
          const right = this.parseAddSub();
          left = { kind: 'binop', op: oneChar, left, right };
          continue;
        }
      }
      break;
    }
    return left;
  }

  private parseAddSub(): Expr {
    let left = this.parseMulDiv();
    while (true) {
      const ch = this.peek();
      if (ch === '+' || ch === '-') {
        this.pos++;
        const right = this.parseMulDiv();
        left = { kind: 'binop', op: ch, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseMulDiv(): Expr {
    let left = this.parseUnary();
    while (true) {
      const ch = this.peek();
      if (ch === '*' || ch === '/') {
        this.pos++;
        const right = this.parseUnary();
        left = { kind: 'binop', op: ch, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseUnary(): Expr {
    const ch = this.peek();
    if (ch === '-') {
      this.pos++;
      const expr = this.parseUnary();
      return { kind: 'unary', op: '-', expr };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    this.skipWhitespace();

    // String literal
    if (this.input[this.pos] === '"') {
      return this.parseString();
    }

    // Parenthesized expression
    if (this.input[this.pos] === '(') {
      this.pos++;
      const expr = this.parseComparison();
      this.skipWhitespace();
      if (this.input[this.pos] !== ')') {
        throw new Error('Expected closing parenthesis');
      }
      this.pos++;
      return expr;
    }

    // Number
    if (/[0-9.]/.test(this.input[this.pos] ?? '')) {
      return this.parseNumber();
    }

    // Identifier: function name, boolean, or cell reference
    if (/[A-Za-z]/.test(this.input[this.pos] ?? '')) {
      return this.parseIdentifier();
    }

    throw new Error(`Unexpected character: '${this.input[this.pos]}'`);
  }

  private parseString(): Expr {
    this.pos++; // skip opening "
    let value = '';
    while (this.pos < this.input.length && this.input[this.pos] !== '"') {
      value += this.input[this.pos];
      this.pos++;
    }
    if (this.input[this.pos] !== '"') {
      throw new Error('Unterminated string');
    }
    this.pos++; // skip closing "
    return { kind: 'string', value };
  }

  private parseNumber(): Expr {
    let num = '';
    while (this.pos < this.input.length && /[0-9.]/.test(this.input[this.pos])) {
      num += this.input[this.pos];
      this.pos++;
    }
    return { kind: 'number', value: parseFloat(num) };
  }

  private parseIdentifier(): Expr {
    let name = '';
    while (this.pos < this.input.length && /[A-Za-z0-9_]/.test(this.input[this.pos])) {
      name += this.input[this.pos];
      this.pos++;
    }

    const upper = name.toUpperCase();

    // Boolean
    if (upper === 'TRUE') return { kind: 'boolean', value: true };
    if (upper === 'FALSE') return { kind: 'boolean', value: false };

    // Function call
    this.skipWhitespace();
    if (this.input[this.pos] === '(') {
      this.pos++; // skip (
      const args: Expr[] = [];
      this.skipWhitespace();
      if (this.input[this.pos] !== ')') {
        args.push(this.parseArgument());
        while (this.peek() === ',') {
          this.pos++;
          args.push(this.parseArgument());
        }
      }
      this.skipWhitespace();
      if (this.input[this.pos] !== ')') {
        throw new Error('Expected closing parenthesis in function call');
      }
      this.pos++;
      return { kind: 'call', name: upper, args };
    }

    // Cell reference
    const normalized = upper;
    if (REF_RE.test(normalized)) {
      return { kind: 'ref', ref: normalized };
    }

    // Unknown name — will produce NAME error at eval time
    return { kind: 'call', name: upper, args: [] };
  }

  private parseArgument(): Expr {
    // Check if this is a range (e.g. A1:B5)
    const saved = this.pos;
    this.skipWhitespace();

    // Try to parse as ref:ref
    if (/[A-Za-z]/.test(this.input[this.pos] ?? '')) {
      let name1 = '';
      const pos1 = this.pos;
      while (this.pos < this.input.length && /[A-Za-z0-9]/.test(this.input[this.pos])) {
        name1 += this.input[this.pos];
        this.pos++;
      }
      this.skipWhitespace();
      if (this.input[this.pos] === ':') {
        this.pos++;
        this.skipWhitespace();
        let name2 = '';
        while (this.pos < this.input.length && /[A-Za-z0-9]/.test(this.input[this.pos])) {
          name2 += this.input[this.pos];
          this.pos++;
        }
        const upper1 = name1.toUpperCase();
        const upper2 = name2.toUpperCase();
        if (REF_RE.test(upper1) && REF_RE.test(upper2)) {
          return { kind: 'range', from: upper1, to: upper2 };
        }
      }
      // Not a range, restore position
      this.pos = pos1;
    } else {
      this.pos = saved;
    }

    return this.parseComparison();
  }
}

function parseFormula(formula: string): Expr {
  const parser = new Parser(formula);
  return parser.parse();
}

// ==================== Evaluation ====================

function collectStaticRefs(expr: Expr): string[] {
  const refs: string[] = [];
  function walk(e: Expr): void {
    switch (e.kind) {
      case 'ref':
        refs.push(e.ref);
        break;
      case 'range': {
        const expanded = expandRange(e.from, e.to);
        refs.push(...expanded);
        break;
      }
      case 'binop':
        walk(e.left);
        walk(e.right);
        break;
      case 'unary':
        walk(e.expr);
        break;
      case 'call':
        for (const arg of e.args) walk(arg);
        break;
    }
  }
  walk(expr);
  return refs;
}

// Collect refs that are actually used during evaluation (for dynamic deps).
// Uses the real evaluator but intercepts ref lookups and IF branches to track deps.
function collectDynamicRefs(
  expr: Expr,
  getVal: (ref: string) => CellValue,
): string[] {
  const refs: string[] = [];

  // Walk the expression, fully evaluating so IF conditions are correct
  function walk(e: Expr): CellValue {
    switch (e.kind) {
      case 'number': return e.value;
      case 'string': return e.value;
      case 'boolean': return e.value;
      case 'ref': {
        refs.push(e.ref);
        return getVal(e.ref);
      }
      case 'range': {
        const expanded = expandRange(e.from, e.to);
        refs.push(...expanded);
        return 0;
      }
      case 'unary': {
        const val = walk(e.expr);
        if (isCellError(val)) return val;
        const n = toNumber(val);
        if (isCellError(n)) return n;
        return -n;
      }
      case 'binop': {
        const lv = walk(e.left);
        if (isCellError(lv)) return lv;
        const rv = walk(e.right);
        if (isCellError(rv)) return rv;

        // Comparison
        if (e.op === '=' || e.op === '<>' || e.op === '<' ||
            e.op === '>' || e.op === '<=' || e.op === '>=') {
          const ln = toNumber(lv);
          const rn = toNumber(rv);
          if (isCellError(ln) || isCellError(rn)) {
            if (typeof lv === 'string' && typeof rv === 'string') {
              switch (e.op) {
                case '=': return lv === rv;
                case '<>': return lv !== rv;
                case '<': return lv < rv;
                case '>': return lv > rv;
                case '<=': return lv <= rv;
                case '>=': return lv >= rv;
              }
            }
            if (isCellError(ln)) return ln;
            return rn as CellError;
          }
          switch (e.op) {
            case '=': return ln === rn;
            case '<>': return ln !== rn;
            case '<': return ln < rn;
            case '>': return ln > rn;
            case '<=': return ln <= rn;
            case '>=': return ln >= rn;
          }
        }

        const ln = toNumber(lv);
        if (isCellError(ln)) return ln;
        const rn = toNumber(rv);
        if (isCellError(rn)) return rn;

        switch (e.op) {
          case '+': return ln + rn;
          case '-': return ln - rn;
          case '*': return ln * rn;
          case '/': return rn === 0 ? { type: 'DIV0' as const, message: 'Division by zero' } : ln / rn;
          default: return 0;
        }
      }
      case 'call': {
        const name = e.name;
        if (name === 'IF' && e.args.length >= 3) {
          // Dynamic: evaluate condition fully, then only walk the taken branch
          const condVal = walk(e.args[0]);
          if (isCellError(condVal)) return condVal;
          const condBool = toBool(condVal);
          if (condBool) {
            return walk(e.args[1]);
          } else {
            return walk(e.args[2]);
          }
        }
        if (name === 'ISERROR' && e.args.length >= 1) {
          const val = walk(e.args[0]);
          return isCellError(val);
        }
        // For aggregates and other functions, walk all args to collect refs
        for (const arg of e.args) walk(arg);
        return 0;
      }
    }
  }
  walk(expr);
  return [...new Set(refs)];
}

function toBool(v: CellValue): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.length > 0;
  return false; // errors are falsy
}

function toNumber(v: CellValue): number | CellError {
  if (isCellError(v)) return v;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    if (!isNaN(n)) return n;
    return { type: 'VALUE', message: `Cannot convert "${v}" to number` };
  }
  return { type: 'VALUE', message: 'Cannot convert to number' };
}

function evalExpr(
  expr: Expr,
  getVal: (ref: string) => CellValue,
): CellValue {
  switch (expr.kind) {
    case 'number': return expr.value;
    case 'string': return expr.value;
    case 'boolean': return expr.value;
    case 'ref': return getVal(expr.ref);
    case 'range': return { type: 'VALUE', message: 'Range not allowed outside aggregate function' };

    case 'unary': {
      const val = evalExpr(expr.expr, getVal);
      if (isCellError(val)) return val;
      const n = toNumber(val);
      if (isCellError(n)) return n;
      return -n;
    }

    case 'binop': {
      const lv = evalExpr(expr.left, getVal);
      if (isCellError(lv)) return lv;
      const rv = evalExpr(expr.right, getVal);
      if (isCellError(rv)) return rv;

      // Comparison operators
      if (expr.op === '=' || expr.op === '<>' || expr.op === '<' ||
          expr.op === '>' || expr.op === '<=' || expr.op === '>=') {
        const ln = toNumber(lv);
        const rn = toNumber(rv);
        if (isCellError(ln) || isCellError(rn)) {
          // Try string comparison if both are strings
          if (typeof lv === 'string' && typeof rv === 'string') {
            switch (expr.op) {
              case '=': return lv === rv;
              case '<>': return lv !== rv;
              case '<': return lv < rv;
              case '>': return lv > rv;
              case '<=': return lv <= rv;
              case '>=': return lv >= rv;
            }
          }
          if (isCellError(ln)) return ln;
          return rn as CellError;
        }
        switch (expr.op) {
          case '=': return ln === rn;
          case '<>': return ln !== rn;
          case '<': return ln < rn;
          case '>': return ln > rn;
          case '<=': return ln <= rn;
          case '>=': return ln >= rn;
        }
      }

      // Arithmetic operators
      const ln = toNumber(lv);
      if (isCellError(ln)) return ln;
      const rn = toNumber(rv);
      if (isCellError(rn)) return rn;

      switch (expr.op) {
        case '+': return ln + rn;
        case '-': return ln - rn;
        case '*': return ln * rn;
        case '/':
          if (rn === 0) return { type: 'DIV0', message: 'Division by zero' };
          return ln / rn;
        default:
          return { type: 'VALUE', message: `Unknown operator: ${expr.op}` };
      }
    }

    case 'call':
      return evalCall(expr.name, expr.args, getVal);
  }
}

function evalCall(
  name: string,
  args: Expr[],
  getVal: (ref: string) => CellValue,
): CellValue {
  switch (name) {
    case 'IF': {
      if (args.length < 3) return { type: 'VALUE', message: 'IF requires 3 arguments' };
      const cond = evalExpr(args[0], getVal);
      if (isCellError(cond)) return cond;
      return toBool(cond) ? evalExpr(args[1], getVal) : evalExpr(args[2], getVal);
    }

    case 'ISERROR': {
      if (args.length < 1) return { type: 'VALUE', message: 'ISERROR requires 1 argument' };
      const val = evalExpr(args[0], getVal);
      return isCellError(val);
    }

    case 'SUM': {
      const values = collectRangeValues(args, getVal);
      let sum = 0;
      for (const v of values) {
        if (isCellError(v)) return v;
        if (typeof v === 'number') sum += v;
      }
      return sum;
    }

    case 'AVG': {
      const values = collectRangeValues(args, getVal);
      let sum = 0;
      let count = 0;
      for (const v of values) {
        if (isCellError(v)) return v;
        if (typeof v === 'number') {
          sum += v;
          count++;
        }
      }
      if (count === 0) return { type: 'DIV0', message: 'No numeric values for AVG' };
      return sum / count;
    }

    case 'MIN': {
      const values = collectRangeValues(args, getVal);
      let min = Infinity;
      let hasNum = false;
      for (const v of values) {
        if (isCellError(v)) return v;
        if (typeof v === 'number') {
          if (v < min) min = v;
          hasNum = true;
        }
      }
      return hasNum ? min : 0;
    }

    case 'MAX': {
      const values = collectRangeValues(args, getVal);
      let max = -Infinity;
      let hasNum = false;
      for (const v of values) {
        if (isCellError(v)) return v;
        if (typeof v === 'number') {
          if (v > max) max = v;
          hasNum = true;
        }
      }
      return hasNum ? max : 0;
    }

    case 'COUNT': {
      const values = collectRangeValues(args, getVal);
      let count = 0;
      for (const v of values) {
        if (isCellError(v)) return v;
        if (typeof v === 'number') count++;
      }
      return count;
    }

    case 'NOW':
      return Date.now();

    case 'RAND':
      return Math.random();

    default:
      return { type: 'NAME', message: `Unknown function: ${name}` };
  }
}

function collectRangeValues(args: Expr[], getVal: (ref: string) => CellValue): CellValue[] {
  const values: CellValue[] = [];
  for (const arg of args) {
    if (arg.kind === 'range') {
      const refs = expandRange(arg.from, arg.to);
      for (const ref of refs) {
        values.push(getVal(ref));
      }
    } else {
      const v = evalExpr(arg, getVal);
      values.push(v);
    }
  }
  return values;
}

// ==================== Spreadsheet ====================

interface CellData {
  formula: string;      // raw formula string
  parsed: Expr | null;  // parsed AST (null for literals)
  value: CellValue;
  isVolatile: boolean;
  dynamicDeps: string[]; // cells this cell actually depends on (after evaluation)
}

function isVolatileExpr(expr: Expr): boolean {
  switch (expr.kind) {
    case 'number':
    case 'string':
    case 'boolean':
    case 'ref':
    case 'range':
      return false;
    case 'unary':
      return isVolatileExpr(expr.expr);
    case 'binop':
      return isVolatileExpr(expr.left) || isVolatileExpr(expr.right);
    case 'call':
      if (expr.name === 'NOW' || expr.name === 'RAND') return true;
      return expr.args.some(isVolatileExpr);
  }
}

export function createSpreadsheet() {
  const cells = new Map<string, CellData>();

  function getCell_internal(ref: string): CellData {
    return cells.get(ref) ?? {
      formula: '',
      parsed: null,
      value: 0,
      isVolatile: false,
      dynamicDeps: [],
    };
  }

  function getCellValue(ref: string): CellValue {
    const cell = cells.get(ref);
    if (!cell) return 0;
    if (cell.isVolatile) {
      // Re-evaluate volatile cells on every access
      return evaluateCell(ref);
    }
    return cell.value;
  }

  function evaluateCell(ref: string): CellValue {
    const cell = cells.get(ref);
    if (!cell || !cell.parsed) return cell?.value ?? 0;

    const val = evalExpr(cell.parsed, (r) => getCellValue(r));

    // Update dynamic deps
    cell.dynamicDeps = collectDynamicRefs(cell.parsed, (r) => getCellValue(r));
    cell.value = val;
    return val;
  }

  function setAndEvaluate(ref: string, formula: string): void {
    const upper = normalizeRef(ref);
    validateRef(upper);

    let parsed: Expr | null = null;
    let value: CellValue = 0;
    let isVol = false;

    if (formula.startsWith('=')) {
      try {
        parsed = parseFormula(formula.slice(1));
        isVol = isVolatileExpr(parsed);
      } catch {
        parsed = null;
        value = { type: 'VALUE', message: `Parse error in formula: ${formula}` };
      }
    } else {
      // Literal
      if (formula === 'TRUE') {
        value = true;
      } else if (formula === 'FALSE') {
        value = false;
      } else if (formula === '') {
        value = 0;
      } else {
        const n = parseFloat(formula);
        if (!isNaN(n) && String(n) === formula) {
          value = n;
        } else {
          // Try integer
          const ni = parseInt(formula, 10);
          if (!isNaN(ni) && String(ni) === formula) {
            value = ni;
          } else {
            value = formula; // string literal
          }
        }
      }
    }

    const staticDeps = parsed ? collectStaticRefs(parsed) : [];

    cells.set(upper, {
      formula,
      parsed,
      value,
      isVolatile: isVol,
      dynamicDeps: staticDeps,
    });
  }

  function reEvaluateAll(changedRefs: Set<string>): void {
    // Find all cells that need re-evaluation (transitive dependents of changed cells)
    const toEval = new Set<string>();
    const queue = [...changedRefs];

    while (queue.length > 0) {
      const ref = queue.shift()!;
      if (toEval.has(ref)) continue;
      toEval.add(ref);
      // Find dependents: cells whose dynamicDeps include ref
      for (const [cellRef, cell] of cells) {
        if (cell.dynamicDeps.includes(ref) && !toEval.has(cellRef)) {
          queue.push(cellRef);
        }
      }
    }

    // Detect circular references first
    const circularCells = detectCircularInternal(toEval);
    for (const ref of circularCells) {
      const cell = cells.get(ref);
      if (cell) {
        cell.value = { type: 'CIRC', message: 'Circular reference detected' };
      }
    }

    // Topological sort of non-circular cells
    // Repeat evaluation in passes to handle dynamic dependency changes
    const nonCircular = [...toEval].filter(r => !circularCells.has(r));

    let maxPasses = 10;
    let changed = true;
    while (changed && maxPasses-- > 0) {
      changed = false;
      const sorted = topoSort(nonCircular);

      for (const ref of sorted) {
        const cell = cells.get(ref);
        if (!cell || !cell.parsed) continue;

        const oldValue = cell.value;
        const oldDeps = [...cell.dynamicDeps];

        evaluateCell(ref);

        // Check if value or deps changed
        if (JSON.stringify(oldValue) !== JSON.stringify(cell.value) ||
            JSON.stringify(oldDeps) !== JSON.stringify(cell.dynamicDeps)) {
          changed = true;
        }
      }
    }
  }

  function topoSort(refs: string[]): string[] {
    const refSet = new Set(refs);
    const visited = new Set<string>();
    const result: string[] = [];

    function visit(ref: string): void {
      if (visited.has(ref)) return;
      visited.add(ref);

      const cell = cells.get(ref);
      if (cell) {
        for (const dep of cell.dynamicDeps) {
          if (refSet.has(dep)) {
            visit(dep);
          }
        }
      }
      result.push(ref);
    }

    for (const ref of refs) visit(ref);
    return result;
  }

  function detectCircularInternal(scope?: Set<string>): Set<string> {
    const circCells = new Set<string>();
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();

    const cellRefs = scope ?? new Set(cells.keys());
    for (const ref of cellRefs) color.set(ref, WHITE);

    function dfs(ref: string, path: string[]): boolean {
      color.set(ref, GRAY);
      path.push(ref);

      const cell = cells.get(ref);
      if (cell) {
        for (const dep of cell.dynamicDeps) {
          if (!cellRefs.has(dep)) continue;
          const c = color.get(dep) ?? BLACK;
          if (c === GRAY) {
            // Found cycle: mark all cells in cycle
            const cycleStart = path.indexOf(dep);
            for (let i = cycleStart; i < path.length; i++) {
              circCells.add(path[i]);
            }
            return true;
          }
          if (c === WHITE) {
            dfs(dep, path);
          }
        }
      }

      path.pop();
      color.set(ref, BLACK);
      return false;
    }

    for (const ref of cellRefs) {
      if (color.get(ref) === WHITE) {
        dfs(ref, []);
      }
    }

    return circCells;
  }

  function getAllDependents(ref: string): string[] {
    const upper = normalizeRef(ref);
    const result: string[] = [];
    for (const [cellRef, cell] of cells) {
      if (cell.dynamicDeps.includes(upper)) {
        result.push(cellRef);
      }
    }
    return result.sort();
  }

  return {
    setCell(ref: string, formula: string): void {
      const upper = normalizeRef(ref);
      validateRef(upper);
      setAndEvaluate(upper, formula);
      reEvaluateAll(new Set([upper]));
    },

    getCell(ref: string): CellValue {
      const upper = normalizeRef(ref);
      validateRef(upper);
      return getCellValue(upper);
    },

    getCellFormula(ref: string): string {
      const upper = normalizeRef(ref);
      validateRef(upper);
      return getCell_internal(upper).formula;
    },

    getDependents(ref: string): string[] {
      const upper = normalizeRef(ref);
      return getAllDependents(upper);
    },

    getDependencies(ref: string): string[] {
      const upper = normalizeRef(ref);
      const cell = cells.get(upper);
      if (!cell) return [];
      return [...cell.dynamicDeps].sort();
    },

    detectCircular(): string[][] {
      const circCells = detectCircularInternal();
      if (circCells.size === 0) return [];

      // Group into cycles
      const cycles: string[][] = [];
      const processed = new Set<string>();

      for (const ref of circCells) {
        if (processed.has(ref)) continue;

        // Trace cycle from this ref
        const cycle: string[] = [];
        let current: string | null = ref;
        const visited = new Set<string>();

        while (current && !visited.has(current)) {
          visited.add(current);
          if (circCells.has(current)) {
            cycle.push(current);
            processed.add(current);
          }
          const cell = cells.get(current);
          if (!cell) break;
          // Find next cell in cycle
          current = cell.dynamicDeps.find(d => circCells.has(d) && !visited.has(d)) ?? null;
        }

        if (cycle.length > 0) {
          cycles.push(cycle.sort());
        }
      }

      return cycles;
    },

    batchSet(updates: Map<string, string>): void {
      const refs = new Set<string>();
      for (const [ref, formula] of updates) {
        const upper = normalizeRef(ref);
        validateRef(upper);
        setAndEvaluate(upper, formula);
        refs.add(upper);
      }
      reEvaluateAll(refs);
    },

    getRange(from: string, to: string): CellValue[][] {
      const upperFrom = normalizeRef(from);
      const upperTo = normalizeRef(to);
      validateRef(upperFrom);
      validateRef(upperTo);

      const f = parseRef(upperFrom);
      const t = parseRef(upperTo);

      if (f.row > t.row || f.col > t.col) {
        throw new SpreadsheetError(`Invalid range: ${from} must be top-left of ${to}`);
      }

      const result: CellValue[][] = [];
      for (let r = f.row; r <= t.row; r++) {
        const row: CellValue[] = [];
        for (let c = f.col; c <= t.col; c++) {
          const ref = refFromColRow(c, r);
          row.push(getCellValue(ref));
        }
        result.push(row);
      }
      return result;
    },
  };
}
