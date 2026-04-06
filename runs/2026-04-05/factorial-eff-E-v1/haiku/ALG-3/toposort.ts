interface Graph<T> {
  nodes: T[];
  edges: Array<[T, T]>;
}

interface TopoSortResult<T> {
  sorted: T[];
  hasCycle: boolean;
}

function topologicalSort<T>(graph: Graph<T>): TopoSortResult<T> {
  const adj = new Map<T, T[]>();
  
  for (const node of graph.nodes) {
    adj.set(node, []);
  }
  
  for (const [u, v] of graph.edges) {
    adj.get(u)!.push(v);
  }
  
  // Colors: 0 = white (unvisited), 1 = gray (visiting), 2 = black (visited)
  const colors = new Map<T, number>();
  const result: T[] = [];
  let hasCycle = false;
  
  function dfs(node: T): void {
    colors.set(node, 1); // Mark as visiting (gray)
    
    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      const color = colors.get(neighbor) ?? 0;
      
      if (color === 1) {
        // Back edge found: cycle detected
        hasCycle = true;
        return;
      }
      
      if (color === 0) {
        // Unvisited: recurse
        dfs(neighbor);
      }
    }
    
    // Mark as visited (black)
    colors.set(node, 2);
    // Add to result in post-order (reverse finish time)
    result.unshift(node);
  }
  
  // Process all nodes
  for (const node of graph.nodes) {
    if ((colors.get(node) ?? 0) === 0) {
      dfs(node);
    }
  }
  
  return {
    sorted: result,
    hasCycle
  };
}

export { topologicalSort, type Graph, type TopoSortResult };