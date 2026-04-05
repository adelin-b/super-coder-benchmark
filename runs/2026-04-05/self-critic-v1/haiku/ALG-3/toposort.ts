// State for DFS: WHITE (unvisited), GRAY (visiting), BLACK (visited)
enum NodeState {
  WHITE = 0,
  GRAY = 1,
  BLACK = 2,
}

export interface Graph {
  [key: string]: string[];
}

export interface ToposortResult {
  sorted: string[];
  hasCycle: boolean;
}

export class CycleDetectedError extends Error {
  constructor(message: string = "Cycle detected in graph") {
    super(message);
    this.name = "CycleDetectedError";
    Object.setPrototypeOf(this, CycleDetectedError.prototype);
  }
}

export function toposort(graph: Graph): ToposortResult {
  const state: Map<string, NodeState> = new Map();
  const sorted: string[] = [];
  let hasCycle = false;

  // Initialize all nodes to WHITE
  const allNodes = new Set<string>();
  
  // Collect all nodes from keys
  for (const node of Object.keys(graph)) {
    allNodes.add(node);
    state.set(node, NodeState.WHITE);
  }
  
  // Collect nodes from adjacency lists
  for (const neighbors of Object.values(graph)) {
    for (const neighbor of neighbors) {
      if (!state.has(neighbor)) {
        allNodes.add(neighbor);
        state.set(neighbor, NodeState.WHITE);
      }
    }
  }

  const visit = (node: string): void => {
    const currentState = state.get(node);
    
    if (currentState === NodeState.BLACK) {
      return; // Already fully visited
    }
    
    if (currentState === NodeState.GRAY) {
      // Back edge found - cycle detected
      hasCycle = true;
      return;
    }

    state.set(node, NodeState.GRAY);

    const neighbors = graph[node] || [];
    for (const neighbor of neighbors) {
      visit(neighbor);
    }

    state.set(node, NodeState.BLACK);
    sorted.unshift(node); // Add to front for topological order
  };

  for (const node of allNodes) {
    if (state.get(node) === NodeState.WHITE) {
      visit(node);
    }
  }

  return {
    sorted,
    hasCycle,
  };
}