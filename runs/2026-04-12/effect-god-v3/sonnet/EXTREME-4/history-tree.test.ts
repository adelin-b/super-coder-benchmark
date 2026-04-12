import { describe, it, expect } from 'vitest';
import { createEditor, ConflictError, EditorError } from './history-tree.js';

describe('EXTREME-4: Undo/Redo with Branching History Tree', () => {
  // === Basic Insert/Delete ===

  it('inserts text into empty document', () => {
    const editor = createEditor();
    editor.insert(0, 'hello');
    expect(editor.getDocument()).toBe('hello');
  });

  it('inserts text at beginning of document', () => {
    const editor = createEditor('world');
    editor.insert(0, 'hello ');
    expect(editor.getDocument()).toBe('hello world');
  });

  it('inserts text at end of document', () => {
    const editor = createEditor('hello');
    editor.insert(5, ' world');
    expect(editor.getDocument()).toBe('hello world');
  });

  it('inserts text in middle of document', () => {
    const editor = createEditor('helo');
    editor.insert(2, 'l');
    expect(editor.getDocument()).toBe('hello');
  });

  it('deletes text from document', () => {
    const editor = createEditor('hello world');
    editor.delete(5, 6);
    expect(editor.getDocument()).toBe('hello');
  });

  it('deletes text from beginning', () => {
    const editor = createEditor('hello world');
    editor.delete(0, 6);
    expect(editor.getDocument()).toBe('world');
  });

  it('deletes entire document content', () => {
    const editor = createEditor('hello');
    editor.delete(0, 5);
    expect(editor.getDocument()).toBe('');
  });

  // === Linear Undo/Redo ===

  it('undo reverts the last operation', () => {
    const editor = createEditor();
    editor.insert(0, 'hello');
    expect(editor.getDocument()).toBe('hello');
    editor.undo();
    expect(editor.getDocument()).toBe('');
  });

  it('redo replays the undone operation', () => {
    const editor = createEditor();
    editor.insert(0, 'hello');
    editor.undo();
    expect(editor.getDocument()).toBe('');
    editor.redo();
    expect(editor.getDocument()).toBe('hello');
  });

  it('multiple undo/redo cycles work correctly', () => {
    const editor = createEditor();
    editor.insert(0, 'a');
    editor.insert(1, 'b');
    editor.insert(2, 'c');
    expect(editor.getDocument()).toBe('abc');

    editor.undo();
    expect(editor.getDocument()).toBe('ab');
    editor.undo();
    expect(editor.getDocument()).toBe('a');
    editor.undo();
    expect(editor.getDocument()).toBe('');

    editor.redo();
    expect(editor.getDocument()).toBe('a');
    editor.redo();
    expect(editor.getDocument()).toBe('ab');
    editor.redo();
    expect(editor.getDocument()).toBe('abc');
  });

  it('undo at root returns false', () => {
    const editor = createEditor();
    expect(editor.undo()).toBe(false);
  });

  it('redo at leaf returns false', () => {
    const editor = createEditor();
    editor.insert(0, 'hello');
    expect(editor.redo()).toBe(false);
  });

  it('canUndo and canRedo reflect state correctly', () => {
    const editor = createEditor();
    expect(editor.canUndo()).toBe(false);
    expect(editor.canRedo()).toBe(false);

    editor.insert(0, 'hi');
    expect(editor.canUndo()).toBe(true);
    expect(editor.canRedo()).toBe(false);

    editor.undo();
    expect(editor.canUndo()).toBe(false);
    expect(editor.canRedo()).toBe(true);
  });

  // === Branching ===

  it('new edit after undo creates a branch', () => {
    const editor = createEditor();
    editor.insert(0, 'hello');
    editor.insert(5, ' world');
    expect(editor.getDocument()).toBe('hello world');

    editor.undo(); // back to "hello"
    editor.insert(5, ' there'); // new branch
    expect(editor.getDocument()).toBe('hello there');

    // Old branch still exists
    const branches = editor.getBranches();
    expect(branches.length).toBe(1);
    expect(branches[0].branches).toHaveLength(2);
  });

  it('redo follows most recently visited branch', () => {
    const editor = createEditor();
    const n1 = editor.insert(0, 'hello');
    const n2 = editor.insert(5, ' world'); // branch 0
    editor.undo(); // back to "hello"
    const n3 = editor.insert(5, ' there'); // branch 1 (most recent)
    editor.undo(); // back to "hello"

    // Redo should follow branch 1 (most recently visited = last created here)
    editor.redo();
    expect(editor.getDocument()).toBe('hello there');
  });

  it('redo follows the branch that was most recently navigated to', () => {
    const editor = createEditor();
    editor.insert(0, 'base');

    // Create branch 0
    editor.insert(4, '-A');
    editor.undo(); // back to "base"

    // Create branch 1
    editor.insert(4, '-B');
    editor.undo(); // back to "base"

    // Navigate to branch 0 explicitly
    const branches = editor.getBranches();
    const branch0NodeId = branches[0].branches[0];
    editor.switchBranch(branch0NodeId);
    expect(editor.getDocument()).toBe('base-A');

    // Go back to "base"
    editor.undo();

    // Redo should now follow branch 0 (most recently visited)
    editor.redo();
    expect(editor.getDocument()).toBe('base-A');
  });

  it('three-way branch point', () => {
    const editor = createEditor();
    editor.insert(0, 'root');

    editor.insert(4, '-A'); // branch 0
    editor.undo();

    editor.insert(4, '-B'); // branch 1
    editor.undo();

    editor.insert(4, '-C'); // branch 2
    editor.undo();

    const branches = editor.getBranches();
    expect(branches).toHaveLength(1);
    expect(branches[0].branches).toHaveLength(3);
  });

  // === Deep Branching ===

  it('branches at different depths', () => {
    const editor = createEditor();
    editor.insert(0, 'a');
    editor.insert(1, 'b');

    // Branch at depth 2
    editor.insert(2, 'c'); // branch 0 of depth-2
    editor.undo();
    editor.insert(2, 'd'); // branch 1 of depth-2

    expect(editor.getDocument()).toBe('abd');

    // Undo twice to go back to 'a'
    editor.undo();
    editor.undo();

    // Branch at depth 1
    editor.insert(1, 'x'); // branch 1 of depth-1
    expect(editor.getDocument()).toBe('ax');

    const branches = editor.getBranches();
    // Should have 2 branch points
    expect(branches).toHaveLength(2);
  });

  // === Document State at Any Node ===

  it('getDocumentAt returns correct state for any node', () => {
    const editor = createEditor('');
    const n1 = editor.insert(0, 'hello');
    const n2 = editor.insert(5, ' world');
    const n3 = editor.insert(11, '!');

    expect(editor.getDocumentAt(n1)).toBe('hello');
    expect(editor.getDocumentAt(n2)).toBe('hello world');
    expect(editor.getDocumentAt(n3)).toBe('hello world!');
  });

  it('getDocumentAt works for nodes on different branches', () => {
    const editor = createEditor('');
    editor.insert(0, 'base');
    const nA = editor.insert(4, '-A');
    editor.undo();
    const nB = editor.insert(4, '-B');

    expect(editor.getDocumentAt(nA)).toBe('base-A');
    expect(editor.getDocumentAt(nB)).toBe('base-B');
  });

  // === Squash ===

  it('squash merges two edits into one', () => {
    const editor = createEditor('');
    editor.insert(0, 'hello');
    editor.insert(5, ' world');
    expect(editor.getDocument()).toBe('hello world');

    editor.squash(2);
    // Document should be the same
    expect(editor.getDocument()).toBe('hello world');
  });

  it('undo after squash reverts all squashed operations', () => {
    const editor = createEditor('');
    editor.insert(0, 'hello');
    editor.insert(5, ' world');
    editor.insert(11, '!');

    editor.squash(3);
    expect(editor.getDocument()).toBe('hello world!');

    editor.undo();
    expect(editor.getDocument()).toBe(''); // back to initial state
  });

  it('squash count < 2 throws', () => {
    const editor = createEditor('');
    editor.insert(0, 'hi');
    expect(() => editor.squash(1)).toThrow(EditorError);
  });

  it('squash count exceeds available history throws', () => {
    const editor = createEditor('');
    editor.insert(0, 'hi');
    expect(() => editor.squash(5)).toThrow(EditorError);
  });

  it('history node count decreases after squash', () => {
    const editor = createEditor('');
    editor.insert(0, 'a');
    editor.insert(1, 'b');
    editor.insert(2, 'c');
    const beforeSquash = editor.getHistory().length;

    editor.squash(3);
    const afterSquash = editor.getHistory().length;
    // Before: root + 3 nodes = 4
    // After: root + 1 squash node = 2
    expect(beforeSquash).toBe(4);
    expect(afterSquash).toBe(2);
  });

  // === Selective Undo ===

  it('selective undo of an insert removes the inserted text', () => {
    const editor = createEditor('');
    const n1 = editor.insert(0, 'hello');
    const n2 = editor.insert(5, ' world');
    expect(editor.getDocument()).toBe('hello world');

    // Selectively undo n1 (the "hello" insert)
    // After n1, n2 inserted " world" at position 5
    // To undo n1's insert at position 0 (length 5):
    // n2 inserted at position 5 (>= 0+5), so no shift to start, but
    // n2's position (5) is at the boundary of our region [0,5) — no overlap
    // Transform: position stays at 0
    // Verify: doc[0:5] = "hello" ✓
    // Result: " world"
    editor.selectiveUndo(n1);
    expect(editor.getDocument()).toBe(' world');
  });

  it('selective undo of an insert with subsequent insert before it', () => {
    const editor = createEditor('');
    const n1 = editor.insert(0, 'world');
    const n2 = editor.insert(0, 'hello ');
    expect(editor.getDocument()).toBe('hello world');

    // Selectively undo n1 (inserted "world" at pos 0, len 5)
    // After n1, n2 inserted "hello " at pos 0 (pos <= n1.pos=0), shift +6
    // Transformed pos = 0 + 6 = 6
    // Verify: doc[6:11] = "world" ✓
    // Result: "hello "
    editor.selectiveUndo(n1);
    expect(editor.getDocument()).toBe('hello ');
  });

  it('selective undo of a delete re-inserts the deleted text', () => {
    const editor = createEditor('hello world');
    const n1 = editor.delete(5, 6); // delete " world"
    expect(editor.getDocument()).toBe('hello');

    // Selectively undo n1 (re-insert " world" at position 5)
    editor.selectiveUndo(n1);
    expect(editor.getDocument()).toBe('hello world');
  });

  it('selective undo of delete with subsequent insert shifting position', () => {
    const editor = createEditor('hello world');
    const n1 = editor.delete(5, 6); // delete " world", doc = "hello"
    const n2 = editor.insert(0, '>>> '); // doc = ">>> hello"
    expect(editor.getDocument()).toBe('>>> hello');

    // Selectively undo n1: re-insert " world" at original pos 5
    // n2 inserted at pos 0 (<=5), shift +4
    // Transformed pos = 5 + 4 = 9
    // Result: ">>> hello world"
    editor.selectiveUndo(n1);
    expect(editor.getDocument()).toBe('>>> hello world');
  });

  it('selective undo throws ConflictError when region was modified', () => {
    const editor = createEditor('hello world');
    const n1 = editor.insert(5, ' beautiful');
    // doc = "hello beautiful world"
    const n2 = editor.delete(5, 10); // delete " beautiful"
    // doc = "hello world"

    // Try to selectively undo n1 (insert " beautiful" at pos 5)
    // n2 deleted at pos 5 (overlaps with our region [5, 15))
    expect(() => editor.selectiveUndo(n1)).toThrow(ConflictError);
  });

  it('selective undo of insert with text verification fails on modified content', () => {
    const editor = createEditor('abcdef');
    const n1 = editor.insert(3, 'XY'); // "abcXYdef"
    const n2 = editor.delete(4, 1); // delete "Y", "abcXdef"

    // Selectively undo n1 (insert "XY" at pos 3, len 2)
    // n2 deleted at pos 4 (within region [3, 5)) → conflict
    expect(() => editor.selectiveUndo(n1)).toThrow(ConflictError);
  });

  it('selective undo of root node throws EditorError', () => {
    const editor = createEditor('test');
    const history = editor.getHistory();
    const rootId = history.find(n => n.parentId === null)!.id;
    expect(() => editor.selectiveUndo(rootId)).toThrow(EditorError);
  });

  it('selective undo with position shifting from delete before target', () => {
    const editor = createEditor('abcdefgh');
    const n1 = editor.insert(4, 'XX'); // "abcdXXefgh"
    const n2 = editor.delete(0, 2); // delete "ab", "cdXXefgh"
    expect(editor.getDocument()).toBe('cdXXefgh');

    // Selectively undo n1: undo insert "XX" at pos 4
    // n2 deleted at pos 0 (< 4), shift -2
    // Transformed pos = 4 - 2 = 2
    // Verify: doc[2:4] = "XX" ✓
    // Result: "cdefgh"
    editor.selectiveUndo(n1);
    expect(editor.getDocument()).toBe('cdefgh');
  });

  // === switchBranch ===

  it('switchBranch navigates to a specific node', () => {
    const editor = createEditor('');
    const n1 = editor.insert(0, 'hello');
    const n2 = editor.insert(5, ' world');

    editor.switchBranch(n1);
    expect(editor.getDocument()).toBe('hello');
  });

  it('switchBranch to non-existent node throws', () => {
    const editor = createEditor('');
    expect(() => editor.switchBranch('nonexistent')).toThrow(EditorError);
  });

  it('edits after switchBranch create a new branch', () => {
    const editor = createEditor('');
    const n1 = editor.insert(0, 'hello');
    const n2 = editor.insert(5, ' world');

    editor.switchBranch(n1);
    editor.insert(5, ' there');
    expect(editor.getDocument()).toBe('hello there');

    // Both branches exist
    expect(editor.getDocumentAt(n2)).toBe('hello world');
  });

  // === Edge Cases ===

  it('empty initial document works correctly', () => {
    const editor = createEditor();
    expect(editor.getDocument()).toBe('');
    editor.insert(0, 'test');
    expect(editor.getDocument()).toBe('test');
  });

  it('initial text is preserved', () => {
    const editor = createEditor('hello world');
    expect(editor.getDocument()).toBe('hello world');
  });

  it('insert at position 0 on non-empty document', () => {
    const editor = createEditor('world');
    editor.insert(0, 'hello ');
    expect(editor.getDocument()).toBe('hello world');
  });

  it('insert out of bounds throws EditorError', () => {
    const editor = createEditor('hello');
    expect(() => editor.insert(-1, 'x')).toThrow(EditorError);
    expect(() => editor.insert(6, 'x')).toThrow(EditorError);
  });

  it('insert empty text throws EditorError', () => {
    const editor = createEditor('hello');
    expect(() => editor.insert(0, '')).toThrow(EditorError);
  });

  it('delete beyond document length throws EditorError', () => {
    const editor = createEditor('hello');
    expect(() => editor.delete(3, 5)).toThrow(EditorError);
  });

  it('delete with zero length throws EditorError', () => {
    const editor = createEditor('hello');
    expect(() => editor.delete(0, 0)).toThrow(EditorError);
  });

  it('delete with negative length throws EditorError', () => {
    const editor = createEditor('hello');
    expect(() => editor.delete(0, -1)).toThrow(EditorError);
  });

  // === Consecutive Undos Past Branch Points ===

  it('multiple undos walk up through branch points correctly', () => {
    const editor = createEditor('');
    const n1 = editor.insert(0, 'a');
    const n2 = editor.insert(1, 'b');

    // Create a branch at n1
    editor.undo(); // back to "a"
    editor.insert(1, 'c'); // branch at n1 → "ac"

    // Now undo past the branch point
    editor.undo(); // back to "a"
    editor.undo(); // back to ""
    expect(editor.getDocument()).toBe('');
    expect(editor.canUndo()).toBe(false);
  });

  // === History Integrity ===

  it('getHistory contains all nodes including across branches', () => {
    const editor = createEditor('');
    const n1 = editor.insert(0, 'hello');
    editor.insert(5, ' world'); // branch 0
    editor.undo();
    editor.insert(5, ' there'); // branch 1

    const history = editor.getHistory();
    // root + n1 + " world" + " there" = 4 nodes
    expect(history.length).toBe(4);
  });

  it('all nodes have valid parentId references', () => {
    const editor = createEditor('');
    editor.insert(0, 'a');
    editor.insert(1, 'b');
    editor.undo();
    editor.insert(1, 'c');

    const history = editor.getHistory();
    const ids = new Set(history.map(n => n.id));
    for (const node of history) {
      if (node.parentId !== null) {
        expect(ids.has(node.parentId)).toBe(true);
      }
    }
  });

  it('root node has null parentId and null operation', () => {
    const editor = createEditor('test');
    const history = editor.getHistory();
    const root = history.find(n => n.parentId === null);
    expect(root).toBeDefined();
    expect(root!.operation).toBeNull();
  });

  // === Undo/Redo with Delete Operations ===

  it('undo of delete restores deleted text', () => {
    const editor = createEditor('hello world');
    editor.delete(5, 6); // delete " world"
    expect(editor.getDocument()).toBe('hello');
    editor.undo();
    expect(editor.getDocument()).toBe('hello world');
  });

  it('redo of delete re-deletes text', () => {
    const editor = createEditor('hello world');
    editor.delete(5, 6);
    editor.undo();
    editor.redo();
    expect(editor.getDocument()).toBe('hello');
  });

  // === Squash Edge Cases ===

  it('squash preserves document state exactly', () => {
    const editor = createEditor('');
    editor.insert(0, 'abc');
    editor.delete(1, 1); // "ac"
    editor.insert(1, 'XY'); // "aXYc"

    const docBefore = editor.getDocument();
    editor.squash(3);
    expect(editor.getDocument()).toBe(docBefore);
    expect(editor.getDocument()).toBe('aXYc');
  });

  it('redo after squash undo is possible', () => {
    const editor = createEditor('');
    editor.insert(0, 'hello');
    editor.insert(5, ' world');
    editor.squash(2);

    editor.undo();
    expect(editor.getDocument()).toBe('');

    editor.redo();
    expect(editor.getDocument()).toBe('hello world');
  });

  // === getBranches ===

  it('getBranches returns empty for linear history', () => {
    const editor = createEditor('');
    editor.insert(0, 'hello');
    editor.insert(5, ' world');
    expect(editor.getBranches()).toHaveLength(0);
  });

  it('getBranches shows activeBranch correctly', () => {
    const editor = createEditor('');
    editor.insert(0, 'base');

    editor.insert(4, '-A'); // branch 0
    editor.undo();
    editor.insert(4, '-B'); // branch 1
    editor.undo();

    const branches = editor.getBranches();
    expect(branches).toHaveLength(1);
    // Most recently created/visited = branch 1
    expect(branches[0].activeBranch).toBe(1);
  });

  // === Mixed Operations ===

  it('interleaved inserts and deletes with undo/redo', () => {
    const editor = createEditor('');
    editor.insert(0, 'abcdef');
    editor.delete(2, 2); // "abef"
    editor.insert(2, 'XY'); // "abXYef"
    expect(editor.getDocument()).toBe('abXYef');

    editor.undo(); // "abef"
    expect(editor.getDocument()).toBe('abef');

    editor.undo(); // "abcdef"
    expect(editor.getDocument()).toBe('abcdef');

    editor.redo(); // "abef"
    editor.redo(); // "abXYef"
    expect(editor.getDocument()).toBe('abXYef');
  });
});
