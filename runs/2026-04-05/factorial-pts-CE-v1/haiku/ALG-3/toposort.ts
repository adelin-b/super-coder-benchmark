export type Node = string | number;
export type Edge = [Node, Node];

export function toposort(nodes: Node[], edges: Edge[]): Node[] {
  // Initialize adjacency list and in-degree map
  const graph = new Map<Node, Node[]>();
  const inDegree = new Map<Node, number>();

  for (const node of nodes) {
    graph.set(node, []);
    inDegree.set(node, 0);
  }

  // Build graph from edges
  for (const [from, to] of edges) {
    if (!graph.has(from)) {
      graph.set(from, []);
    }
    if (!graph.has(to)) {
      graph.set(to, []);
    }
    graph.get(from)!.push(to);
    inDegree.set(to, (inDegree.get(to) || 0) + 1);
  }

  // Kahn's algorithm
  const queue: Node[] = [];
  
  // Find all nodes with no incoming edges
  for (const node of nodes) {
    if (inDegree.get(node) === 0) {
      queue.push(node);
    }
  }

  const result: Node[] = [];
  
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    // Reduce in-degree for neighbors
    for (const neighbor of graph.get(node) || []) {
      const newDegree = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, newDegree);
      
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Check for cycles - if not all nodes processed, there's a cycle
  if (result.length !== nodes.length) {
    throw new Error('Cycle detected in graph');
  }

  return result;
}