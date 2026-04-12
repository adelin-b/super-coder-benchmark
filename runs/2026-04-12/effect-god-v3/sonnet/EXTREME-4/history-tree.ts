export interface HistoryNode {
  id: string;
  parentId: string | null;
  operation: Operation | null;
  children: string[];
  branchIndex: number;
}

export interface Operation {
  type: 'insert' | 'delete' | 'squash';
  position: number;
  text: string;
}

export interface BranchInfo {
  branchNodeId: string;
  branches: string[];
  activeBranch: number;
}

export class ConflictError extends Error {
  constructor(msg?: string) {
    super(msg ?? "Conflict in selective undo");
    this.name = "ConflictError";
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class EditorError extends Error {
  constructor(msg?: string) {
    super(msg ?? "Editor error");
    this.name = "EditorError";
    Object.setPrototypeOf(this, EditorError.prototype);
  }
}

export function createEditor(initialText: string = ""): {
  insert(position: number, text: string): string;
  delete(position: number, length: number): string;
  undo(): boolean;
  redo(): boolean;
  squash(count: number): string;
  selectiveUndo(nodeId: string): string;
  getDocument(): string;
  getDocumentAt(nodeId: string): string;
  getHistory(): HistoryNode[];
  getBranches(): BranchInfo[];
  switchBranch(nodeId: string): void;
  canUndo(): boolean;
  canRedo(): boolean;
} {
  interface InternalNode {
    id: string;
    parentId: string | null;
    operation: Operation | null;
    children: string[];
    branchIndex: number;
    documentState: string;
  }

  let nodeCounter = 0;
  let branchCounter = 0;

  const nodes = new Map<string, InternalNode>();
  // Maps a node ID (branch point) → most recently visited child ID
  const lastVisited = new Map<string, string>();

  const rootId = `node-${++nodeCounter}`;
  nodes.set(rootId, {
    id: rootId,
    parentId: null,
    operation: null,
    children: [],
    branchIndex: 0,
    documentState: initialText,
  });

  let currentNodeId = rootId;

  function getNode(id: string): InternalNode {
    const n = nodes.get(id);
    if (!n) throw new EditorError(`Node ${id} not found`);
    return n;
  }

  function pathFromRoot(targetId: string): string[] {
    const path: string[] = [];
    let id: string | null = targetId;
    while (id !== null) {
      path.unshift(id);
      const n = nodes.get(id);
      id = n ? n.parentId : null;
    }
    return path;
  }

  function markVisited(childId: string): void {
    const n = nodes.get(childId);
    if (n && n.parentId !== null) {
      lastVisited.set(n.parentId, childId);
    }
  }

  function createChildNode(op: Operation, docState: string): string {
    const parent = getNode(currentNodeId);
    const newId = `node-${++nodeCounter}`;

    const bi =
      parent.children.length === 0 ? parent.branchIndex : ++branchCounter;

    const newNode: InternalNode = {
      id: newId,
      parentId: currentNodeId,
      operation: op,
      children: [],
      branchIndex: bi,
      documentState: docState,
    };

    nodes.set(newId, newNode);
    parent.children.push(newId);
    markVisited(newId);
    currentNodeId = newId;
    return newId;
  }

  return {
    insert(position: number, text: string): string {
      if (!text || text.length === 0) {
        throw new EditorError("Insert text cannot be empty");
      }
      const doc = getNode(currentNodeId).documentState;
      if (position < 0 || position > doc.length) {
        throw new EditorError(
          `Insert position ${position} out of bounds for document of length ${doc.length}`
        );
      }
      const newDoc = doc.slice(0, position) + text + doc.slice(position);
      return createChildNode({ type: "insert", position, text }, newDoc);
    },

    delete(position: number, length: number): string {
      if (length <= 0) {
        throw new EditorError("Delete length must be greater than 0");
      }
      const doc = getNode(currentNodeId).documentState;
      if (position < 0 || position > doc.length) {
        throw new EditorError(
          `Delete position ${position} out of bounds for document of length ${doc.length}`
        );
      }
      if (position + length > doc.length) {
        throw new EditorError(
          `Delete range [${position}, ${position + length}) exceeds document length ${doc.length}`
        );
      }
      const deletedText = doc.slice(position, position + length);
      const newDoc = doc.slice(0, position) + doc.slice(position + length);
      return createChildNode(
        { type: "delete", position, text: deletedText },
        newDoc
      );
    },

    undo(): boolean {
      const n = getNode(currentNodeId);
      if (n.parentId === null) return false;
      currentNodeId = n.parentId;
      return true;
    },

    redo(): boolean {
      const n = getNode(currentNodeId);
      if (n.children.length === 0) return false;

      let nextId: string;
      if (n.children.length === 1) {
        nextId = n.children[0];
      } else {
        const lv = lastVisited.get(currentNodeId);
        nextId =
          lv && n.children.includes(lv)
            ? lv
            : n.children[n.children.length - 1];
      }

      currentNodeId = nextId;
      markVisited(nextId);
      return true;
    },

    squash(count: number): string {
      if (count < 2) {
        throw new EditorError("Squash count must be >= 2");
      }

      // Collect the chain of `count` nodes starting from current going backward
      const chain: string[] = [];
      let cur = currentNodeId;
      for (let i = 0; i < count; i++) {
        const n = getNode(cur);
        if (n.parentId === null) {
          throw new EditorError(
            "Not enough operations to squash (reached root)"
          );
        }
        chain.push(cur);
        cur = n.parentId;
      }
      const ancestorId = cur;

      // Validate linearity: chain[1..count-1] must each have exactly 1 child
      for (let i = 1; i < chain.length; i++) {
        if (getNode(chain[i]).children.length > 1) {
          throw new EditorError("Cannot squash across a branch point");
        }
      }

      const oldestId = chain[chain.length - 1];
      const squashDocState = getNode(chain[0]).documentState;
      const oldestBranchIndex = getNode(oldestId).branchIndex;
      const ancestor = getNode(ancestorId);

      const newId = `node-${++nodeCounter}`;
      const squashNode: InternalNode = {
        id: newId,
        parentId: ancestorId,
        operation: { type: "squash", position: 0, text: `squash(${count})` },
        children: [],
        branchIndex: oldestBranchIndex,
        documentState: squashDocState,
      };
      nodes.set(newId, squashNode);

      // Replace oldestId in ancestor's children with newId
      const idx = ancestor.children.indexOf(oldestId);
      if (idx !== -1) {
        ancestor.children[idx] = newId;
      } else {
        ancestor.children.push(newId);
      }

      // Update lastVisited if it pointed to the replaced node
      if (lastVisited.get(ancestorId) === oldestId) {
        lastVisited.set(ancestorId, newId);
      }

      currentNodeId = newId;
      markVisited(newId);
      return newId;
    },

    selectiveUndo(nodeId: string): string {
      if (!nodes.has(nodeId)) {
        throw new EditorError(`Node ${nodeId} not found`);
      }
      const targetNode = getNode(nodeId);
      if (!targetNode.operation) {
        throw new EditorError("Cannot selectively undo the root node");
      }

      const targetOp = targetNode.operation;
      const pathToCurrent = pathFromRoot(currentNodeId);
      const pathToTarget = pathFromRoot(nodeId);

      // Find index of last common ancestor
      let caIdx = 0;
      for (
        let i = 0;
        i < Math.min(pathToCurrent.length, pathToTarget.length);
        i++
      ) {
        if (pathToCurrent[i] === pathToTarget[i]) caIdx = i;
        else break;
      }

      // Collect subsequent operations for OT
      let subOps: Operation[];
      const targetInCurrentPath = pathToCurrent.indexOf(nodeId);
      if (targetInCurrentPath !== -1) {
        // Target is an ancestor of current; subsequent ops are those after it
        subOps = pathToCurrent
          .slice(targetInCurrentPath + 1)
          .map((id) => nodes.get(id)?.operation ?? null)
          .filter((op): op is Operation => op !== null);
      } else {
        // Target not ancestor of current; use ops from common ancestor down to current
        subOps = pathToCurrent
          .slice(caIdx + 1)
          .map((id) => nodes.get(id)?.operation ?? null)
          .filter((op): op is Operation => op !== null);
      }

      const currentDoc = getNode(currentNodeId).documentState;

      if (targetOp.type === "insert") {
        // Undo insert → we need to delete the inserted text
        let pos = targetOp.position;
        const len = targetOp.text.length;

        for (const sop of subOps) {
          if (sop.type === "insert") {
            if (sop.position <= pos) {
              pos += sop.text.length;
            }
          } else if (sop.type === "delete") {
            if (sop.position < pos) {
              pos = Math.max(0, pos - sop.text.length);
            }
          }
          // squash ops: skip OT adjustment, rely on text conflict check
        }

        // Conflict check: text at transformed position must match original insert
        if (
          pos < 0 ||
          pos + len > currentDoc.length ||
          currentDoc.slice(pos, pos + len) !== targetOp.text
        ) {
          throw new ConflictError(
            `Conflict: text at transformed position does not match original insert "${targetOp.text}"`
          );
        }

        const newDoc = currentDoc.slice(0, pos) + currentDoc.slice(pos + len);
        return createChildNode(
          { type: "delete", position: pos, text: targetOp.text },
          newDoc
        );
      } else if (targetOp.type === "delete") {
        // Undo delete → we need to re-insert the deleted text
        let pos = targetOp.position;

        for (const sop of subOps) {
          if (sop.type === "insert") {
            if (sop.position <= pos) {
              pos += sop.text.length;
            }
          } else if (sop.type === "delete") {
            if (sop.position < pos) {
              pos = Math.max(0, pos - sop.text.length);
            }
          }
        }

        // Clamp position to valid document range
        pos = Math.max(0, Math.min(pos, currentDoc.length));

        const newDoc =
          currentDoc.slice(0, pos) + targetOp.text + currentDoc.slice(pos);
        return createChildNode(
          { type: "insert", position: pos, text: targetOp.text },
          newDoc
        );
      } else {
        // squash operations are not selectively undoable
        throw new EditorError(
          "Cannot selectively undo a squash operation"
        );
      }
    },

    getDocument(): string {
      return getNode(currentNodeId).documentState;
    },

    getDocumentAt(nodeId: string): string {
      if (!nodes.has(nodeId)) {
        throw new EditorError(`Node ${nodeId} not found`);
      }
      return getNode(nodeId).documentState;
    },

    getHistory(): HistoryNode[] {
      return Array.from(nodes.values()).map((n) => ({
        id: n.id,
        parentId: n.parentId,
        operation: n.operation,
        children: [...n.children],
        branchIndex: n.branchIndex,
      }));
    },

    getBranches(): BranchInfo[] {
      const result: BranchInfo[] = [];
      for (const node of nodes.values()) {
        if (node.children.length >= 2) {
          const lv = lastVisited.get(node.id);
          let activeBranch = node.children.length - 1;
          if (lv) {
            const idx = node.children.indexOf(lv);
            if (idx !== -1) activeBranch = idx;
          }
          result.push({
            branchNodeId: node.id,
            branches: [...node.children],
            activeBranch,
          });
        }
      }
      return result;
    },

    switchBranch(nodeId: string): void {
      if (!nodes.has(nodeId)) {
        throw new EditorError(`Node ${nodeId} not found`);
      }
      currentNodeId = nodeId;
      markVisited(nodeId);
    },

    canUndo(): boolean {
      return getNode(currentNodeId).parentId !== null;
    },

    canRedo(): boolean {
      return getNode(currentNodeId).children.length > 0;
    },
  };
}