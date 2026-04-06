export type Graph = Record<string, string[]>;

export function toposort(graph: Graph): string[] {
  // Input validation
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
    throw new Error('Graph must be a valid object');
  }

  const inDegree: Record<string, number> = {};
  const adjList: Record<string, string[]> = {};

  // Initialize nodes from graph keys
  const nodes = Object.keys(graph);
  for (const node of nodes) {
    inDegree[node] = 0;
    const edges = graph[node];
    if (!Array.isArray(edges)) {
      throw new Error(`Adjacency list for node "${node}" must be an array`);
    }
    adjList[node] = edges;
  }

  // Calculate in-degrees and build adjacency list for all nodes
  for (const node of nodes) {
    for (const neighbor of graph[node]) {
      if (typeof neighbor !== 'string') {
        throw new Error('All node references must be strings');
      }
      // Add neighbor to graph if not already present
      if (!(neighbor in inDegree)) {
        inDegree[neighbor] = 0;
        adjList[neighbor] = [];
      }
      inDegree[neighbor]++;
    }
  }

  // Kahn's algorithm: collect all nodes with in-degree 0
  const queue: string[] = [];
  for (const node of Object.keys(inDegree)) {
    if (inDegree[node] === 0) {
      queue.push(node);
    }
  }

  const result: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    // Reduce in-degree for all neighbors
    for (const neighbor of adjList[node]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }

  // If we couldn't process all nodes, there's a cycle
  if (result.length !== Object.keys(inDegree).length) {
    throw new Error('Cycle detected in graph');
  }

  return result;
}