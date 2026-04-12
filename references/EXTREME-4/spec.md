# EXTREME-4: Undo/Redo with Branching History Tree

## Overview
Implement a text editor history system with a branching undo/redo tree. The system supports insert and delete operations, linear undo/redo, branching when new edits are made after undo, squashing edits, and selective undo of specific past edits using operational transformation. The history forms a tree (not a linear stack), and all nodes remain reachable.

## Exported API

```ts
export interface HistoryNode {
  id: string;
  parentId: string | null;
  operation: Operation | null;   // null for root node
  children: string[];            // child node IDs
  branchIndex: number;           // which branch this node is on (0-based)
}

export interface Operation {
  type: 'insert' | 'delete' | 'squash';
  position: number;
  text: string;                  // for insert: text inserted; for delete: text deleted; for squash: composite text description
}

export interface BranchInfo {
  branchNodeId: string;          // the node where branching occurred
  branches: string[];            // IDs of first nodes of each branch
  activeBranch: number;          // index of the most recently visited branch
}

export class ConflictError extends Error {}
export class EditorError extends Error {}

export function createEditor(initialText?: string): {
  /** Insert text at position. Position 0 = before first char. */
  insert(position: number, text: string): string;   // returns node ID

  /** Delete `length` characters starting at position. */
  delete(position: number, length: number): string;  // returns node ID

  /** Undo the last operation on the current branch. Returns false if nothing to undo. */
  undo(): boolean;

  /** Redo the next operation. If at a branch point, follows the most recently visited branch. Returns false if nothing to redo. */
  redo(): boolean;

  /**
   * Squash the last `count` operations on the current branch into one.
   * The squashed operation has the combined effect of all `count` operations.
   * After squash, undoing undoes the entire squash as one step.
   * Throws EditorError if count < 2 or count exceeds available operations.
   */
  squash(count: number): string;  // returns new squash node ID

  /**
   * Selectively undo a specific past operation by its node ID.
   * Uses operational transformation to adjust positions based on
   * all operations that occurred after the target.
   * Throws ConflictError if the region was modified by later operations
   * (the original text at the transformed position no longer matches).
   * Returns the new node ID for the selective undo operation.
   */
  selectiveUndo(nodeId: string): string;

  /** Get current document text. */
  getDocument(): string;

  /** Get document text at a specific history node. */
  getDocumentAt(nodeId: string): string;

  /** Get all history nodes. */
  getHistory(): HistoryNode[];

  /** Get all branch points in the tree. */
  getBranches(): BranchInfo[];

  /**
   * Navigate to a specific node in the tree.
   * The document state becomes the state at that node.
   * Future edits will branch from this node.
   */
  switchBranch(nodeId: string): void;

  /** Whether undo is possible from current position. */
  canUndo(): boolean;

  /** Whether redo is possible from current position. */
  canRedo(): boolean;
};
```

## Detailed Requirements

### Operations
- `insert(position, text)`: Inserts `text` at `position`. Position 0 is before the first character. Position equal to document length appends.
- `delete(position, length)`: Deletes `length` characters starting at `position`. The deleted text is stored in the operation for undo purposes.
- Both operations create a new node in the history tree as a child of the current node.
- Throws `EditorError` if position is out of bounds (< 0 or > document length for insert, > document length for delete start, or position + length > document length for delete).
- Throws `EditorError` if insert text is empty or delete length is <= 0.

### Undo/Redo
- `undo()` moves from the current node to its parent. The document reverts to the parent's state.
- `redo()` moves from the current node to a child. If the current node has multiple children (branch point), it follows the **most recently visited** branch.
- "Most recently visited" means: the last branch that was navigated to via redo, switchBranch, or by making a new edit. Initially (before any branch switching), the most recent branch is the one created last.
- Returns `true` if the operation was performed, `false` if at root (undo) or leaf (redo).

### Branching
- If the current node has been undone to (i.e., user is not at a leaf), and a new edit is made, a NEW branch is created from the current node.
- The old branch(es) are preserved. All nodes remain in the tree.
- The new branch becomes the "most recently visited" branch for that branch point.
- Branch points are nodes with 2+ children.

### Squash
- `squash(count)` merges the last `count` operations into a single composite operation.
- The squashed node replaces the `count` nodes: its parent is the parent of the oldest squashed node, and its effect on the document is the composition of all `count` operations.
- After squash, the history looks as if a single operation was performed.
- Undoing a squash restores the document to the state before all `count` operations.
- `count` must be >= 2.
- The `count` operations must be a linear chain (no branches within the squashed range).
- Throws `EditorError` if count < 2, exceeds available linear history, or spans a branch point.

### Selective Undo
`selectiveUndo(nodeId)` undoes a specific historical operation without undoing operations that came after it.

**Operational Transformation Rules:**
The target operation must be transformed against all subsequent operations to find where its effect is in the current document.

For an insert being selectively undone (we need to delete the inserted text):
- For each subsequent operation that inserted text at a position <= the target's position: shift the target position forward by the length of that insertion.
- For each subsequent operation that inserted text at a position > the target's position: no shift.
- For each subsequent operation that deleted text at a position < the target's position: shift the target position backward by the length of the deletion (but not below 0).
- For each subsequent operation that deleted text that overlaps the target's inserted region: throw `ConflictError`.

For a delete being selectively undone (we need to re-insert the deleted text):
- Apply similar position-shifting logic based on subsequent operations.
- If any subsequent operation inserted or deleted text within the region where we need to re-insert: the position shifts accordingly.

**Conflict Detection:**
After transforming, verify the text at the computed position matches what's expected:
- For undoing an insert: the text at the transformed position must match the originally inserted text. If not, throw `ConflictError`.
- For undoing a delete: no conflict check needed (we're re-inserting).

Selective undo creates a new node in the history tree (as a child of the current node).

### Document State
- `getDocument()` returns the text at the current position in the history tree.
- `getDocumentAt(nodeId)` reconstructs the document by replaying operations from root to the specified node.
- The initial state (root node) has the `initialText` (default: empty string).

### Tree Navigation
- `getBranches()` returns information about all branch points (nodes with 2+ children).
- `switchBranch(nodeId)` sets the current position to the specified node. The document state becomes the state at that node.
- Throws `EditorError` if nodeId does not exist.

### Node IDs
- Each node gets a unique string ID (implementation-defined, e.g., "node-1", "node-2").
- The root node also has an ID.

### Edge Cases
- Empty initial document: operations work normally.
- Insert at position 0 (beginning) and at document length (end).
- Delete that removes entire document content.
- Multiple sequential undos past branch points (should walk up the tree).
- Redo at a branch point with no prior visit: follow the last-created branch.
- Squash at root: error (not enough operations).
- Selective undo of the root node: error (root has no operation).
- Selective undo of a node not on the current branch's ancestry: still works (transforms against operations from that node to current state).

## Invariants
1. `getDocument()` always returns a valid string.
2. `getDocumentAt(nodeId)` is deterministic — same node always yields same text.
3. Undo followed by redo (on a linear history) returns to the same state.
4. After squash, `getDocument()` returns the same text as before squash.
5. `getHistory()` contains all nodes ever created (nothing is deleted).
6. Branch points have 2+ children; non-branch nodes have 0 or 1 child.
7. Selective undo of an insert followed by selective undo of the selective-undo's delete restores original text.
8. The root node's parentId is null.
