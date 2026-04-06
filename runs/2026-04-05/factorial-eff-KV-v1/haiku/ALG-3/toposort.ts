export class CycleError extends Error {
  constructor(message: string = "Cycle detected in graph") {
    super(message)
    this.name = "CycleError"
  }
}

export interface Graph<T> {
  nodes: T[]
  edges: Array<[T, T]>
}

export function topologicalSort<T>(graph: Graph<T>): T[] {
  if (!graph) {
    throw new Error("Graph is required")
  }

  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error("Graph must have nodes and edges arrays")
  }

  if (graph.nodes.length === 0) {
    return []
  }

  // Build adjacency list and in-degree map
  const adjacency = new Map<T, T[]>()
  const inDegree = new Map<T, number>()
  const nodeSet = new Set<T>()

  // Initialize all nodes
  for (const node of graph.nodes) {
    if (node === null || node === undefined) {
      throw new Error("Graph contains null or undefined nodes")
    }
    adjacency.set(node, [])
    inDegree.set(node, 0)
    nodeSet.add(node)
  }

  // Build graph from edges
  for (const edge of graph.edges) {
    if (!Array.isArray(edge) || edge.length !== 2) {
      throw new Error("Each edge must be a tuple of [source, target]")
    }

    const [u, v] = edge

    if (!nodeSet.has(u)) {
      throw new Error(`Edge references unknown source node: ${u}`)
    }
    if (!nodeSet.has(v)) {
      throw new Error(`Edge references unknown target node: ${v}`)
    }

    adjacency.get(u)!.push(v)
    inDegree.set(v, (inDegree.get(v) ?? 0) + 1)
  }

  // Kahn's algorithm using BFS
  const queue: T[] = []
  for (const [node, degree] of inDegree) {
    if (degree === 0) {
      queue.push(node)
    }
  }

  const result: T[] = []
  while (queue.length > 0) {
    const node = queue.shift()!
    result.push(node)

    for (const neighbor of adjacency.get(node) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) {
        queue.push(neighbor)
      }
    }
  }

  // Check for cycles: if not all nodes were processed, there's a cycle
  if (result.length !== graph.nodes.length) {
    throw new CycleError("Graph contains one or more cycles")
  }

  return result
}

export function hasCycle<T>(graph: Graph<T>): boolean {
  try {
    topologicalSort(graph)
    return false
  } catch (e) {
    if (e instanceof CycleError) {
      return true
    }
    throw e
  }
}