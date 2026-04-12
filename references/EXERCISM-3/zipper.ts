interface BinaryTree {
  value: number;
  left: BinaryTree | null;
  right: BinaryTree | null;
}

type TrailEntry = ['left' | 'right', number, BinaryTree | null];

function fromTrail(tree: BinaryTree, last: TrailEntry): BinaryTree {
  if (last[0] === 'left') {
    return {
      value: last[1],
      left: tree,
      right: last[2],
    };
  }
  return {
    value: last[1],
    left: last[2],
    right: tree,
  };
}

function rebuildTree(tree: BinaryTree, trail: TrailEntry[]): BinaryTree {
  if (trail.length === 0) return tree;
  const last = trail[0];
  return rebuildTree(fromTrail(tree, last), trail.slice(1));
}

export class Zipper {
  private tree: BinaryTree;
  private trail: TrailEntry[];

  constructor(tree: BinaryTree, trail: TrailEntry[]) {
    this.tree = tree;
    this.trail = trail;
  }

  static fromTree(tree: BinaryTree): Zipper {
    return new Zipper(tree, []);
  }

  toTree(): BinaryTree {
    return rebuildTree(this.tree, this.trail);
  }

  value(): number {
    return this.tree.value;
  }

  left(): Zipper | null {
    if (!this.tree.left) return null;

    return new Zipper(
      this.tree.left,
      [['left', this.tree.value, this.tree.right] as TrailEntry].concat(this.trail),
    );
  }

  right(): Zipper | null {
    if (!this.tree.right) return null;

    return new Zipper(
      this.tree.right,
      [['right', this.tree.value, this.tree.left] as TrailEntry].concat(this.trail),
    );
  }

  up(): Zipper | null {
    if (this.trail.length === 0) return null;

    const last = this.trail[0];
    return new Zipper(fromTrail(this.tree, last), this.trail.slice(1));
  }

  setValue(value: number): Zipper {
    return new Zipper(
      { value, left: this.tree.left, right: this.tree.right },
      this.trail,
    );
  }

  setLeft(left: BinaryTree | null): Zipper {
    return new Zipper(
      { value: this.tree.value, left, right: this.tree.right },
      this.trail,
    );
  }

  setRight(right: BinaryTree | null): Zipper {
    return new Zipper(
      { value: this.tree.value, left: this.tree.left, right },
      this.trail,
    );
  }
}
