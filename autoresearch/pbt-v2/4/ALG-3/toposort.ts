type Graph = Record<string, string[]>;
type Color = 'white' | 'gray' | 'black';

export function topoSort(graph: Graph): string[] {
  const visited = new Map<string, Color>();
  const result: string[] = [];
  
  // Initialize all nodes as white (both keys and nodes in edges)
  for (const node in graph) {
    visited.set(node, 'white');
  }
  for (const edges of Object.values(graph)) {
    for (const node of edges) {
      if (!visited.has(node)) {
        visited.set(node, 'white');
      }
    }
  }
  
  const visit = (node: string): void => {
    const color = visited.get(node);
    
    if (color === 'gray') {
      throw new Error(`Cycle detected`);
    }
    if (color === 'black') {
      return;
    }
    
    visited.set(node, 'gray');
    
    if (graph[node]) {
      for (const neighbor of graph[node]) {
        visit(neighbor);
      }
    }
    
    visited.set(node, 'black');
    result.unshift(node);
  };
  
  for (const node of visited.keys()) {
    if (visited.get(node) === 'white') {
      visit(node);
    }
  }
  
  return result;
}

export function hasCycle(graph: Graph): boolean {
  try {
    topoSort(graph);
    return false;
  } catch {
    return true;
  }
}