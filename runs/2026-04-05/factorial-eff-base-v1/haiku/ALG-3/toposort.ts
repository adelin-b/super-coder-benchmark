export class CycleDetectedError extends Error {
  constructor(message: string = "Cycle detected in graph") {
    super(message)
    this.name = "CycleDetectedError"
    Object.setPrototypeOf(this, CycleDetectedError.prototype)
  }
}

export interface Graph<T> {
  nodes: T[]
  edges: [from: T, to: T][]
}

/**
 * Topologically sorts a directed acyclic graph (DAG).
 * Every edge u→v will have u appear before v in the result.
 * @throws CycleDetectedError if the graph contains a cycle
 */
export function toposort<T>(graph: Graph<T>): T[] {
  // Build adjacency list and in-degree map
  const adjList = new Map<T, T[]>()
  const inDegree = new Map<T, number>()

  // Initialize all nodes
  for (const node of graph.nodes) {
    adjList.set(node, [])
    inDegree.set(node, 0)
  }

  // Build graph structure from edges
  for (const [from, to] of graph.edges) {
    adjList.get(from)!.push(to)
    inDegree.set(to, (inDegree.get(to) ?? 0) + 1)
  }

  // Kahn's algorithm: find all nodes with in-degree 0
  const queue: T[] = []
  for (const [node, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(node)
    }
  }

  const result: T[] = []
  while (queue.length > 0) {
    const node = queue.shift()!
    result.push(node)

    // Process all neighbors
    for (const neighbor of adjList.get(node)!) {
      inDegree.set(neighbor, inDegree.get(neighbor)! - 1)
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor)
      }
    }
  }

  // If not all nodes were processed, a cycle exists
  if (result.length !== graph.nodes.length) {
    throw new CycleDetectedError()
  }

  return result
}