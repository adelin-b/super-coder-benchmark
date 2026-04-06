export function toposort(
  graph: Map<string, string[]> | Record<string, string[]>
): string[] {
  if (!graph) {
    throw new Error('Graph cannot be null or undefined');
  }

  const adjacencyList = graph instanceof Map 
    ? graph 
    : new Map(Object.entries(graph));
  
  const visited = new Map<string, 'unvisited' | 'visiting' | 'visited'>();
  const result: string[] = [];
  
  // Collect all nodes (including those appearing only as targets)
  const allNodes = new Set<string>();
  for (const node of adjacencyList.keys()) {
    allNodes.add(node);
  }
  for (const neighbors of adjacencyList.values()) {
    if (!Array.isArray(neighbors)) {
      throw new Error('Graph adjacency values must be arrays');
    }
    for (const neighbor of neighbors) {
      if (typeof neighbor !== 'string') {
        throw new Error('Graph node names must be strings');
      }
      allNodes.add(neighbor);
    }
  }
  
  // Initialize visited states
  for (const node of allNodes) {
    visited.set(node, 'unvisited');
  }
  
  function dfs(node: string): void {
    const state = visited.get(node);
    
    if (state === 'visiting') {
      throw new Error('Cycle detected in graph');
    }
    
    if (state === 'visited') {
      return;
    }
    
    visited.set(node, 'visiting');
    const neighbors = adjacencyList.get(node) || [];
    for (const neighbor of neighbors) {
      dfs(neighbor);
    }
    visited.set(node, 'visited');
    result.push(node);
  }
  
  for (const node of allNodes) {
    if (visited.get(node) === 'unvisited') {
      dfs(node);
    }
  }
  
  return result.reverse();
}