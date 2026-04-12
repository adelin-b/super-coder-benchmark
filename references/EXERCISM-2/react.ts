class InputCell {
  value: number;
  private subscribers: ComputeCell[] = [];

  constructor(value: number) {
    this.value = value;
  }

  setValue(value: number): void {
    if (value !== this.value) {
      this.value = value;
      this.notify();
    }
  }

  private notify(): void {
    this.subscribers.forEach((sub) => {
      sub.markForUpdate();
    });
    this.subscribers.forEach((sub) => {
      sub.update();
    });
  }

  addSubscriber(sub: ComputeCell): void {
    this.subscribers.push(sub);
  }
}

class ComputeCell {
  value: number;
  private fn: (cells: Array<{ value: number }>) => number;
  private inputCells: Array<InputCell | ComputeCell>;
  private subscribers: ComputeCell[] = [];
  private callbacks: CallbackCell[] = [];
  private updated: boolean = true;
  private lastValue: number;

  constructor(
    inputCells: Array<InputCell | ComputeCell>,
    fn: (cells: Array<{ value: number }>) => number,
  ) {
    this.fn = fn;
    this.inputCells = inputCells;
    this.inputCells.forEach((cell) => {
      cell.addSubscriber(this);
    });
    this.value = fn(inputCells);
    this.lastValue = this.value;
  }

  update(): void {
    const value = this.fn(this.inputCells);
    if (value !== this.value) {
      this.value = value;
      this.updated = true;
      this.notify();
    }
  }

  private notify(): void {
    this.subscribers.forEach((sub) => {
      sub.markForUpdate();
    });
    this.subscribers.forEach((sub) => {
      sub.update();
    });
    this.runCallbacks();
  }

  markForUpdate(): void {
    this.updated = false;
    this.subscribers.forEach((sub) => {
      sub.markForUpdate();
    });
  }

  private runCallbacks(): void {
    if (this.allInputsUpdated() && this.valueChanged()) {
      this.lastValue = this.value;
      this.callbacks.forEach((cb) => {
        cb.run(this);
      });
    }
  }

  private allInputsUpdated(): boolean {
    return this.inputCells.every(
      (cell) => (cell as any).updated !== false,
    );
  }

  private valueChanged(): boolean {
    return this.lastValue !== this.value;
  }

  addSubscriber(sub: ComputeCell): void {
    this.subscribers.push(sub);
  }

  addCallback(cb: CallbackCell): void {
    this.callbacks.push(cb);
  }

  removeCallback(cb: CallbackCell): void {
    this.callbacks = this.callbacks.filter((c) => c !== cb);
  }
}

class CallbackCell {
  values: any[] = [];
  private fn: (cell: { value: number }) => any;

  constructor(fn: (cell: { value: number }) => any) {
    this.fn = fn;
  }

  run(cell: { value: number }): void {
    this.values.push(this.fn(cell));
  }
}

export { InputCell, ComputeCell, CallbackCell };
