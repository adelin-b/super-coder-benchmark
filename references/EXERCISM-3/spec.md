# EXERCISM-3: Binary Tree Zipper

## Overview
Creating a zipper for a binary tree.

Zippers are a purely functional way of navigating within a data structure and manipulating it. They essentially contain a data structure and a pointer into that data structure (called the focus).

For a binary tree, the zipper supports these operations:

- `fromTree` - get a zipper out of a binary tree, the focus is on the root node
- `toTree` - get the binary tree out of the zipper
- `value` - get the value of the focus node
- `left` - move the focus to the left child (returns null if no left child)
- `right` - move the focus to the right child (returns null if no right child)
- `up` - move the focus to the parent (returns null if at root)
- `setValue` - set the value of the focus node, returns a new zipper
- `setLeft` - set the left child of the focus node, returns a new zipper
- `setRight` - set the right child of the focus node, returns a new zipper

## Exported API

```ts
interface BinaryTree {
  value: number;
  left: BinaryTree | null;
  right: BinaryTree | null;
}

export class Zipper {
  static fromTree(tree: BinaryTree): Zipper;
  toTree(): BinaryTree;
  value(): number;
  left(): Zipper | null;
  right(): Zipper | null;
  up(): Zipper | null;
  setValue(value: number): Zipper;
  setLeft(tree: BinaryTree | null): Zipper;
  setRight(tree: BinaryTree | null): Zipper;
}
```

## Rules

### Immutability
- All mutation operations (setValue, setLeft, setRight) return a NEW Zipper instance
- The original zipper is not modified
- Navigation operations (left, right, up) also return new Zipper instances

### Tree Reconstruction
- `toTree()` always returns the complete tree, regardless of current focus position
- After navigating down and back up, the tree should be unchanged
- After navigating down, modifying, and calling toTree, the full tree reflects the change

### Navigation
- `left()` returns null if no left child exists
- `right()` returns null if no right child exists
- `up()` returns null if already at root
- Navigating the same logical path via different routes should produce equal zippers
