export interface Graph<T> {
  nodes: T[]
  edges: Array<[T, T]>
}

export class CycleError extends Error {
  constructor(message: string = "Cycle detected in graph") {
    super(message)
    this.name = "CycleError"
  }
}

export function toposort<T>(graph: Graph<T>): T[] {
  const { nodes, edges } = graph

  const nodeSet = new Set(nodes)
  const adjList = new Map<T, T[]>()
  const inDegree = new Map<T, number>()

  // Initialize all nodes
  for (const node of nodes) {
    adjList.set(node, [])
    inDegree.set(node, 0)
  }

  // Build graph from edges
  for (const [from, to] of edges) {
    if (!nodeSet.has(from) || !nodeSet.has(to)) {
      throw new Error("Edge references non-existent node")
    }
    adjList.get(from)!.push(to)
    inDegree.set(to, (inDegree.get(to) || 0) + 1)
  }

  // Kahn's algorithm
  const queue: T[] = []
  const result: T[] = []

  // Add all nodes with in-degree 0
  for (const node of nodes) {
    if (inDegree.get(node) === 0) {
      queue.push(node)
    }
  }

  while (queue.length > 0) {
    const node = queue.shift()!
    result.push(node)

    for (const neighbor of adjList.get(node)!) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) {
        queue.push(neighbor)
      }
    }
  }

  // Check for cycle: if we didn't process all nodes, there's a cycle
  if (result.length !== nodes.length) {
    throw new CycleError()
  }

  return result
}

export function hasCycle<T>(graph: Graph<T>): boolean {
  try {
    toposort(graph)
    return false
  } catch (e) {
    if (e instanceof CycleError) {
      return true
    }
    throw e
  }
}