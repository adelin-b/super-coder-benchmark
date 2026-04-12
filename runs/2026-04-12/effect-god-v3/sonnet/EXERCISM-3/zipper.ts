interface BinaryTree {
  value: number;
  left: BinaryTree | null;
  right: BinaryTree | null;
}

type Crumb =
  | { dir: "left"; parentValue: number; right: BinaryTree | null }
  | { dir: "right"; parentValue: number; left: BinaryTree | null };

export class Zipper {
  private constructor(
    private readonly focus: BinaryTree,
    private readonly crumbs: ReadonlyArray<Crumb>
  ) {}

  static fromTree(tree: BinaryTree): Zipper {
    return new Zipper(tree, []);
  }

  toTree(): BinaryTree {
    // Walk up all crumbs to reconstruct root
    let zipper: Zipper = this;
    let parent = zipper.up();
    while (parent !== null) {
      zipper = parent;
      parent = zipper.up();
    }
    return zipper.focus;
  }

  value(): number {
    return this.focus.value;
  }

  left(): Zipper | null {
    if (this.focus.left === null) return null;
    const crumb: Crumb = {
      dir: "left",
      parentValue: this.focus.value,
      right: this.focus.right,
    };
    return new Zipper(this.focus.left, [...this.crumbs, crumb]);
  }

  right(): Zipper | null {
    if (this.focus.right === null) return null;
    const crumb: Crumb = {
      dir: "right",
      parentValue: this.focus.value,
      left: this.focus.left,
    };
    return new Zipper(this.focus.right, [...this.crumbs, crumb]);
  }

  up(): Zipper | null {
    if (this.crumbs.length === 0) return null;
    const crumbs = [...this.crumbs];
    const crumb = crumbs.pop()!;
    let parentNode: BinaryTree;
    if (crumb.dir === "left") {
      parentNode = {
        value: crumb.parentValue,
        left: this.focus,
        right: crumb.right,
      };
    } else {
      parentNode = {
        value: crumb.parentValue,
        left: crumb.left,
        right: this.focus,
      };
    }
    return new Zipper(parentNode, crumbs);
  }

  setValue(value: number): Zipper {
    return new Zipper(
      { value, left: this.focus.left, right: this.focus.right },
      this.crumbs
    );
  }

  setLeft(tree: BinaryTree | null): Zipper {
    return new Zipper(
      { value: this.focus.value, left: tree, right: this.focus.right },
      this.crumbs
    );
  }

  setRight(tree: BinaryTree | null): Zipper {
    return new Zipper(
      { value: this.focus.value, left: this.focus.left, right: tree },
      this.crumbs
    );
  }
}