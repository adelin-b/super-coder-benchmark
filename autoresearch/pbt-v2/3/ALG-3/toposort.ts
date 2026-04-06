export class CycleError extends Error {
  constructor(message = "Cycle detected in graph") {
    super(message)
    this.name = "CycleError"
  }
}

export function toposort<T>(
  nodes: T[],
  edges: Array<[T, T]>
): T[] {
  // Build adjacency list and in-degree count
  const adjList = new Map<T, T[]>()
  const inDegree = new Map<T, number>()

  // Initialize all nodes
  for (const node of nodes) {
    adjList.set(node, [])
    inDegree.set(node, 0)
  }

  // Process all edges
  for (const [u, v] of edges) {
    adjList.get(u)!.push(v)
    inDegree.set(v, (inDegree.get(v) ?? 0) + 1)
  }

  // Kahn's algorithm: queue all nodes with in-degree 0
  const queue: T[] = []
  for (const node of nodes) {
    if (inDegree.get(node) === 0) {
      queue.push(node)
    }
  }

  const result: T[] = []
  while (queue.length > 0) {
    const node = queue.shift()!
    result.push(node)

    // Reduce in-degree for all neighbors
    for (const neighbor of adjList.get(node) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) {
        queue.push(neighbor)
      }
    }
  }

  // Cycle detection: if not all nodes were processed, there's a cycle
  if (result.length !== nodes.length) {
    throw new CycleError("Cycle detected in graph")
  }

  return result
}