export interface Graph<T> {
  nodes: T[]
  edges: Array<[T, T]>
}

export interface ToposortResult<T> {
  sorted: T[]
  hasCycle: boolean
}

export function toposort<T>(graph: Graph<T>): ToposortResult<T> {
  if (!graph || !Array.isArray(graph.nodes)) {
    throw new Error("Invalid graph: nodes must be an array")
  }
  if (!Array.isArray(graph.edges)) {
    throw new Error("Invalid graph: edges must be an array")
  }

  if (graph.nodes.length === 0) {
    return { sorted: [], hasCycle: false }
  }

  // Check for duplicate nodes
  const nodeSet = new Set<T>()
  for (const node of graph.nodes) {
    if (nodeSet.has(node)) {
      throw new Error("Duplicate node in graph")
    }
    nodeSet.add(node)
  }

  const inDegree = new Map<T, number>()
  const adjacencyList = new Map<T, T[]>()

  // Initialize
  for (const node of graph.nodes) {
    inDegree.set(node, 0)
    adjacencyList.set(node, [])
  }

  // Build graph, skipping duplicate edges
  for (const [from, to] of graph.edges) {
    if (!nodeSet.has(from) || !nodeSet.has(to)) {
      throw new Error("Invalid edge: referenced node not in graph")
    }

    const neighbors = adjacencyList.get(from)!
    if (!neighbors.includes(to)) {
      inDegree.set(to, (inDegree.get(to) ?? 0) + 1)
      neighbors.push(to)
    }
  }

  // Kahn's algorithm
  const queue: T[] = []
  for (const [node, degree] of inDegree) {
    if (degree === 0) {
      queue.push(node)
    }
  }

  const sorted: T[] = []
  while (queue.length > 0) {
    const node = queue.shift()!
    sorted.push(node)

    for (const neighbor of adjacencyList.get(node) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) {
        queue.push(neighbor)
      }
    }
  }

  const hasCycle = sorted.length !== graph.nodes.length

  return {
    sorted,
    hasCycle,
  }
}