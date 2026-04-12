function collectAffected(start: Set<ComputeCell>): ComputeCell[] {
  const affected = new Set<ComputeCell>();
  const toVisit = [...start];
  while (toVisit.length > 0) {
    const cell = toVisit.pop()!;
    if (affected.has(cell)) continue;
    affected.add(cell);
    for (const dep of cell._dependents) {
      toVisit.push(dep);
    }
  }
  return [...affected].sort((a, b) => a._level - b._level);
}

function propagate(start: Set<ComputeCell>): void {
  const sorted = collectAffected(start);
  const changed: ComputeCell[] = [];

  for (const cell of sorted) {
    const oldValue = cell.value;
    const newValue = cell._recompute();
    cell.value = newValue;
    if (oldValue !== newValue) {
      changed.push(cell);
    }
  }

  for (const cell of changed) {
    for (const cb of cell._callbacks) {
      cb._fire(cell);
    }
  }
}

export class InputCell {
  value: number;
  _dependents: Set<ComputeCell> = new Set();

  constructor(value: number) {
    this.value = value;
  }

  setValue(value: number): void {
    this.value = value;
    propagate(new Set(this._dependents));
  }
}

export class ComputeCell {
  value: number;
  _inputs: Array<InputCell | ComputeCell>;
  _fn: (cells: Array<{ value: number }>) => number;
  _callbacks: Set<CallbackCell> = new Set();
  _dependents: Set<ComputeCell> = new Set();
  _level: number;

  constructor(
    inputCells: Array<InputCell | ComputeCell>,
    fn: (cells: Array<{ value: number }>) => number
  ) {
    this._inputs = inputCells;
    this._fn = fn;
    this._level = 0;

    for (const cell of inputCells) {
      if (cell instanceof ComputeCell) {
        this._level = Math.max(this._level, cell._level + 1);
      } else {
        this._level = Math.max(this._level, 1);
      }
      cell._dependents.add(this);
    }

    this.value = fn(inputCells);
  }

  _recompute(): number {
    return this._fn(this._inputs);
  }

  addCallback(cb: CallbackCell): void {
    this._callbacks.add(cb);
  }

  removeCallback(cb: CallbackCell): void {
    this._callbacks.delete(cb);
  }
}

export class CallbackCell {
  values: any[] = [];
  private _fn: (cell: { value: number }) => any;

  constructor(fn: (cell: { value: number }) => any) {
    this._fn = fn;
  }

  _fire(cell: { value: number }): void {
    this.values.push(this._fn(cell));
  }
}