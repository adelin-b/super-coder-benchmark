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
    Object.setPrototypeOf(this, SpreadsheetError.prototype);
  }
}

// ─── Tokenizer ────────────────────────────────────────────────────────────────

type TT =
  | 'NUM' | 'STR' | 'BOOL' | 'IDENT' | 'FUNC'
  | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH'
  | 'GT' | 'LT' | 'GTE' | 'LTE' | 'EQ' | 'NEQ'
  | 'LPAREN' | 'RPAREN' | 'COMMA' | 'COLON' | 'EOF';

interface Tok { type: TT; value: string | number | boolean }

function tokenize(s: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && s[i] <= ' ') i++;
    if (i >= s.length) break;
    const ch = s[i];
    if (ch === '"') {
      let v = ''; i++;
      while (i < s.length && s[i] !== '"') v += s[i++];
      if (i < s.length) i++;
      toks.push({ type: 'STR', value: v }); continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < s.length && /[0-9]/.test(s[i + 1]))) {
      let v = '';
      while (i < s.length && /[0-9.]/.test(s[i])) v += s[i++];
      toks.push({ type: 'NUM', value: parseFloat(v) }); continue;
    }
    const two = s.slice(i, i + 2);
    if (two === '<>') { toks.push({ type: 'NEQ', value: '<>' }); i += 2; continue; }
    if (two === '<=') { toks.push({ type: 'LTE', value: '<=' }); i += 2; continue; }
    if (two === '>=') { toks.push({ type: 'GTE', value: '>=' }); i += 2; continue; }
    const OP: Record<string, TT> = {
      '+': 'PLUS', '-': 'MINUS', '*': 'STAR', '/': 'SLASH',
      '>': 'GT', '<': 'LT', '=': 'EQ',
      '(': 'LPAREN', ')': 'RPAREN', ',': 'COMMA', ':': 'COLON',
    };
    if (ch in OP) { toks.push({ type: OP[ch], value: ch }); i++; continue; }
    if (/[A-Za-z_]/.test(ch)) {
      let v = '';
      while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) v += s[i++];
      const u = v.toUpperCase();
      if (u === 'TRUE') { toks.push({ type: 'BOOL', value: true }); continue; }
      if (u === 'FALSE') { toks.push({ type: 'BOOL', value: false }); continue; }
      let j = i; while (j < s.length && s[j] === ' ') j++;
      toks.push({ type: j < s.length && s[j] === '(' ? 'FUNC' : 'IDENT', value: u }); continue;
    }
    i++;
  }
  toks.push({ type: 'EOF', value: '' });
  return toks;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function mkErr(type: CellError['type'], msg: string): CellError {
  return { type, message: msg };
}

class FormulaParser {
  private pos = 0;
  directVol = false;

  constructor(
    private readonly toks: Tok[],
    private readonly getVal: (r: string) => CellValue,
    private readonly onVol: () => void,
  ) {}

  parse(): CellValue { return this.cmp(); }

  private peek(): Tok { return this.toks[this.pos]; }
  private eat(): Tok { return this.toks[this.pos++]; }
  private expect(t: TT): void { if (this.toks[this.pos]?.type === t) this.pos++; }

  private cmp(): CellValue {
    let v = this.add();
    const t = this.peek().type;
    if (t === 'GT' || t === 'LT' || t === 'GTE' || t === 'LTE' || t === 'EQ' || t === 'NEQ') {
      this.eat();
      const r = this.add();
      if (isCellError(v)) return v;
      if (isCellError(r)) return r;
      if (t === 'EQ') return v === r;
      if (t === 'NEQ') return v !== r;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [lv, rv] = [v as any, r as any];
      if (t === 'GT') return lv > rv;
      if (t === 'LT') return lv < rv;
      if (t === 'GTE') return lv >= rv;
      return lv <= rv;
    }
    return v;
  }

  private add(): CellValue {
    let v = this.mul();
    while (this.peek().type === 'PLUS' || this.peek().type === 'MINUS') {
      const op = this.eat().type;
      const r = this.mul();
      if (isCellError(v)) return v;
      if (isCellError(r)) return r;
      if (typeof v !== 'number') return mkErr('VALUE', 'Expected number');
      if (typeof r !== 'number') return mkErr('VALUE', 'Expected number');
      v = op === 'PLUS' ? v + r : v - r;
    }
    return v;
  }

  private mul(): CellValue {
    let v = this.una();
    while (this.peek().type === 'STAR' || this.peek().type === 'SLASH') {
      const op = this.eat().type;
      const r = this.una();
      if (isCellError(v)) return v;
      if (isCellError(r)) return r;
      if (typeof v !== 'number') return mkErr('VALUE', 'Expected number');
      if (typeof r !== 'number') return mkErr('VALUE', 'Expected number');
      if (op === 'SLASH') {
        if (r === 0) return mkErr('DIV0', 'Division by zero');
        v = v / r;
      } else v = v * r;
    }
    return v;
  }

  private una(): CellValue {
    if (this.peek().type === 'MINUS') {
      this.eat();
      const v = this.pri();
      if (isCellError(v)) return v;
      if (typeof v !== 'number') return mkErr('VALUE', 'Expected number');
      return -v;
    }
    if (this.peek().type === 'PLUS') this.eat();
    return this.pri();
  }

  private pri(): CellValue {
    const t = this.peek();
    if (t.type === 'NUM') { this.eat(); return t.value as number; }
    if (t.type === 'STR') { this.eat(); return t.value as string; }
    if (t.type === 'BOOL') { this.eat(); return t.value as boolean; }
    if (t.type === 'IDENT') {
      this.eat();
      const ref = t.value as string;
      if (!isValidRef(ref)) return mkErr('REF', `Invalid cell reference: ${ref}`);
      return this.getVal(ref);
    }
    if (t.type === 'FUNC') return this.fn();
    if (t.type === 'LPAREN') {
      this.eat();
      const v = this.cmp();
      this.expect('RPAREN');
      return v;
    }
    if (t.type === 'EOF') return mkErr('VALUE', 'Unexpected end of expression');
    this.eat();
    return mkErr('VALUE', `Unexpected token: ${t.type}`);
  }

  private fn(): CellValue {
    const name = this.eat().value as string;
    this.expect('LPAREN');
    switch (name) {
      case 'IF': return this.fnIF();
      case 'ISERROR': { const v = this.cmp(); this.expect('RPAREN'); return isCellError(v); }
      case 'NOW': { this.expect('RPAREN'); this.directVol = true; this.onVol(); return Date.now(); }
      case 'RAND': { this.expect('RPAREN'); this.directVol = true; this.onVol(); return Math.random(); }
      case 'SUM': case 'AVG': case 'MIN': case 'MAX': case 'COUNT': return this.fnAgg(name);
      default: {
        let d = 1;
        while (d > 0 && this.peek().type !== 'EOF') {
          const tt = this.eat().type;
          if (tt === 'LPAREN') d++; else if (tt === 'RPAREN') d--;
        }
        return mkErr('NAME', `Unknown function: ${name}`);
      }
    }
  }

  private fnIF(): CellValue {
    const cond = this.cmp();
    this.expect('COMMA');
    if (isCellError(cond)) {
      this.skip(); this.expect('COMMA'); this.skip(); this.expect('RPAREN');
      return cond;
    }
    const truthy = cond !== false && cond !== 0 && cond !== '';
    let result: CellValue;
    if (truthy) {
      result = this.cmp(); this.expect('COMMA'); this.skip();
    } else {
      this.skip(); this.expect('COMMA'); result = this.cmp();
    }
    this.expect('RPAREN');
    return result;
  }

  private skip(): void {
    let d = 0;
    while (this.peek().type !== 'EOF') {
      const t = this.peek().type;
      if (d === 0 && (t === 'COMMA' || t === 'RPAREN')) return;
      this.eat();
      if (t === 'LPAREN') d++; else if (t === 'RPAREN') d--;
    }
  }

  private fnAgg(name: string): CellValue {
    const vals: CellValue[] = [];
    if (this.peek().type !== 'RPAREN') {
      this.aggArg(vals);
      while (this.peek().type === 'COMMA') { this.eat(); this.aggArg(vals); }
    }
    this.expect('RPAREN');
    return aggCalc(name, vals);
  }

  private aggArg(vals: CellValue[]): void {
    const cells = this.tryRange();
    if (cells) { for (const c of cells) vals.push(this.getVal(c)); }
    else vals.push(this.cmp());
  }

  private tryRange(): string[] | null {
    if (this.peek().type !== 'IDENT') return null;
    const p = this.pos;
    const from = this.eat().value as string;
    if (this.peek().type !== 'COLON') { this.pos = p; return null; }
    this.eat();
    if (this.peek().type !== 'IDENT') { this.pos = p; return null; }
    const to = this.eat().value as string;
    return expandRange(from, to);
  }
}

function aggCalc(name: string, vals: CellValue[]): CellValue {
  for (const v of vals) if (isCellError(v)) return v;
  const nums = vals.filter(v => typeof v === 'number') as number[];
  switch (name) {
    case 'SUM': return nums.reduce((a, b) => a + b, 0);
    case 'AVG': return nums.length
      ? nums.reduce((a, b) => a + b, 0) / nums.length
      : mkErr('DIV0', 'No numeric values');
    case 'MIN': return nums.length ? Math.min(...nums) : 0;
    case 'MAX': return nums.length ? Math.max(...nums) : 0;
    case 'COUNT': return nums.length;
    default: return mkErr('NAME', `Unknown: ${name}`);
  }
}

// ─── Cell reference helpers ───────────────────────────────────────────────────

function parseRef(ref: string): { col: number; row: number } | null {
  const m = ref.match(/^([A-Z]{1,2})([0-9]{1,3})$/);
  if (!m) return null;
  const row = parseInt(m[2], 10);
  if (row < 1 || row > 999) return null;
  const cs = m[1];
  const col = cs.length === 1
    ? cs.charCodeAt(0) - 65
    : (cs.charCodeAt(0) - 64) * 26 + (cs.charCodeAt(1) - 65);
  if (col < 0 || col > 51) return null;
  return { col, row };
}

function isValidRef(ref: string): boolean {
  return parseRef(ref) !== null;
}

function colToStr(col: number): string {
  if (col < 26) return String.fromCharCode(65 + col);
  return (
    String.fromCharCode(64 + Math.floor(col / 26)) +
    String.fromCharCode(65 + (col % 26))
  );
}

function expandRange(from: string, to: string): string[] {
  const f = parseRef(from.toUpperCase());
  const t = parseRef(to.toUpperCase());
  if (!f || !t) return [];
  const cells: string[] = [];
  const r1 = Math.min(f.row, t.row), r2 = Math.max(f.row, t.row);
  const c1 = Math.min(f.col, t.col), c2 = Math.max(f.col, t.col);
  for (let r = r1; r <= r2; r++)
    for (let c = c1; c <= c2; c++)
      cells.push(colToStr(c) + r);
  return cells;
}

function parseLiteral(s: string): CellValue {
  const t = s.trim();
  if (!t) return 0;
  const u = t.toUpperCase();
  if (u === 'TRUE') return true;
  if (u === 'FALSE') return false;
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) return t.slice(1, -1);
  const n = Number(t);
  if (!isNaN(n)) return n;
  return t;
}

// ─── Spreadsheet engine ──────────────────────────────────────────────────────

export function createSpreadsheet() {
  // formula store, value cache, dependency graph
  const fmlMap = new Map<string, string>();
  const valMap = new Map<string, CellValue>();
  const depsMap = new Map<string, Set<string>>();   // ref → cells it depends on
  const rdepsMap = new Map<string, Set<string>>();  // ref → cells that depend on it
  const volSet = new Set<string>();                  // transitively volatile cells

  function ensure(ref: string): void {
    if (!depsMap.has(ref)) depsMap.set(ref, new Set());
    if (!rdepsMap.has(ref)) rdepsMap.set(ref, new Set());
  }

  function setDepsFor(ref: string, newDeps: Set<string>): void {
    const old = depsMap.get(ref) ?? new Set<string>();
    for (const d of old) rdepsMap.get(d)?.delete(ref);
    depsMap.set(ref, new Set(newDeps));
    for (const d of newDeps) {
      ensure(d);
      rdepsMap.get(d)!.add(ref);
    }
  }

  function transitiveRDeps(root: string): Set<string> {
    const visited = new Set<string>();
    const q = [root];
    while (q.length) {
      const r = q.shift()!;
      for (const rd of rdepsMap.get(r) ?? new Set<string>()) {
        if (!visited.has(rd)) { visited.add(rd); q.push(rd); }
      }
    }
    return visited;
  }

  // Core recursive evaluator with cycle detection via evalStack (Set for O(1))
  function evalCell(ref: string, dirty: Set<string>, evalStack: Set<string>): CellValue {
    // Cycle detected
    if (evalStack.has(ref)) return mkErr('CIRC', `Circular reference: ${ref}`);
    // Return cached if not dirty
    if (!dirty.has(ref)) return valMap.get(ref) ?? 0;

    const fml = fmlMap.get(ref);
    if (!fml) {
      dirty.delete(ref);
      valMap.set(ref, 0);
      setDepsFor(ref, new Set());
      volSet.delete(ref);
      return 0;
    }

    if (!fml.startsWith('=')) {
      const v = parseLiteral(fml);
      dirty.delete(ref);
      valMap.set(ref, v);
      setDepsFor(ref, new Set());
      volSet.delete(ref);
      return v;
    }

    evalStack.add(ref);
    const newDeps = new Set<string>();
    let isVol = false;
    let value: CellValue;

    try {
      const toks = tokenize(fml.slice(1).trim());
      const parser = new FormulaParser(
        toks,
        (cr: string) => {
          newDeps.add(cr);
          if (volSet.has(cr)) isVol = true;
          return evalCell(cr, dirty, evalStack);
        },
        () => { isVol = true; },
      );
      value = parser.parse();
      if (parser.directVol) isVol = true;
    } catch (e) {
      value = mkErr('VALUE', String(e));
    }

    evalStack.delete(ref);
    dirty.delete(ref);
    valMap.set(ref, value);
    setDepsFor(ref, newDeps);
    if (isVol) volSet.add(ref); else volSet.delete(ref);
    return value;
  }

  function evalAll(dirty: Set<string>): void {
    const evalStack = new Set<string>();
    for (const r of [...dirty]) evalCell(r, dirty, evalStack);
  }

  function normalizeRef(ref: string): string {
    const n = ref.toUpperCase().trim();
    if (!isValidRef(n)) throw new SpreadsheetError(`Invalid cell reference: ${ref}`);
    return n;
  }

  return {
    setCell(ref: string, formula: string): void {
      const n = normalizeRef(ref);
      ensure(n);
      // Collect all cells that need re-evaluation
      const dirty = transitiveRDeps(n);
      dirty.add(n);
      fmlMap.set(n, formula);
      evalAll(dirty);
    },

    getCell(ref: string): CellValue {
      const n = normalizeRef(ref);
      if (volSet.has(n)) {
        // Collect volatile chain (cell + its volatile deps, transitively)
        const chain = new Set<string>();
        const collect = (r: string) => {
          if (chain.has(r) || !volSet.has(r)) return;
          chain.add(r);
          for (const d of depsMap.get(r) ?? new Set<string>()) collect(d);
        };
        collect(n);
        // Re-evaluate the chain (recursive evalCell handles ordering)
        evalCell(n, chain, new Set());
      }
      return valMap.get(n) ?? 0;
    },

    getCellFormula(ref: string): string {
      const n = normalizeRef(ref);
      return fmlMap.get(n) ?? '';
    },

    getDependents(ref: string): string[] {
      const n = normalizeRef(ref);
      return [...(rdepsMap.get(n) ?? new Set<string>())];
    },

    getDependencies(ref: string): string[] {
      const n = normalizeRef(ref);
      return [...(depsMap.get(n) ?? new Set<string>())];
    },

    detectCircular(): string[][] {
      // Tarjan's SCC on dynamic dep graph
      const allCells = new Set<string>(fmlMap.keys());
      const idx = new Map<string, number>();
      const low = new Map<string, number>();
      const onStk = new Set<string>();
      const stk: string[] = [];
      let cnt = 0;
      const cycles: string[][] = [];

      const sc = (v: string): void => {
        idx.set(v, cnt); low.set(v, cnt); cnt++;
        stk.push(v); onStk.add(v);

        for (const w of depsMap.get(v) ?? new Set<string>()) {
          if (!idx.has(w)) {
            sc(w);
            low.set(v, Math.min(low.get(v)!, low.get(w)!));
          } else if (onStk.has(w)) {
            low.set(v, Math.min(low.get(v)!, idx.get(w)!));
          }
        }

        if (low.get(v) === idx.get(v)) {
          const scc: string[] = [];
          let w: string;
          do { w = stk.pop()!; onStk.delete(w); scc.push(w); } while (w !== v);
          if (scc.length > 1 || (depsMap.get(scc[0])?.has(scc[0]) ?? false)) {
            cycles.push(scc);
          }
        }
      };

      for (const v of allCells) if (!idx.has(v)) sc(v);
      return cycles;
    },

    batchSet(updates: Map<string, string>): void {
      const normed = new Map<string, string>();
      for (const [ref, formula] of updates) normed.set(normalizeRef(ref), formula);

      const dirty = new Set<string>();
      for (const n of normed.keys()) {
        for (const r of transitiveRDeps(n)) dirty.add(r);
        dirty.add(n);
      }
      // Set all formulas before evaluating
      for (const [n, formula] of normed) { ensure(n); fmlMap.set(n, formula); }
      evalAll(dirty);
    },

    getRange(from: string, to: string): CellValue[][] {
      const fn = normalizeRef(from);
      const tn = normalizeRef(to);
      const fp = parseRef(fn)!;
      const tp = parseRef(tn)!;

      if (fp.row > tp.row || fp.col > tp.col) {
        throw new SpreadsheetError(`Invalid range ${from}:${to} — from must be top-left`);
      }

      const result: CellValue[][] = [];
      for (let row = fp.row; row <= tp.row; row++) {
        const rowArr: CellValue[] = [];
        for (let col = fp.col; col <= tp.col; col++) {
          rowArr.push(valMap.get(colToStr(col) + row) ?? 0);
        }
        result.push(rowArr);
      }
      return result;
    },
  };
}