export function topoSort<T>(
  graph: Map<T, T[]> | Record<string | number, (string | number)[]>
): T[] {
  const adjacencyList = new Map<T, T[]>()
  const inDegree = new Map<T, number>()
  const allNodes = new Set<T>()

  // Normalize input and build graph structure
  if (graph instanceof Map) {
    for (const [node, neighbors] of graph) {
      adjacencyList.set(node, neighbors || [])
      allNodes.add(node)
      if (!inDegree.has(node)) inDegree.set(node, 0)
      for (const neighbor of neighbors || []) {
        allNodes.add(neighbor)
        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) + 1)
      }
    }
  } else {
    for (const [nodeStr, neighbors] of Object.entries(graph)) {
      const node = nodeStr as unknown as T
      adjacencyList.set(node, (neighbors as T[]) || [])
      allNodes.add(node)
      if (!inDegree.has(node)) inDegree.set(node, 0)
      for (const neighbor of neighbors || []) {
        const neighborKey = neighbor as unknown as T
        allNodes.add(neighborKey)
        inDegree.set(neighborKey, (inDegree.get(neighborKey) || 0) + 1)
      }
    }
  }

  // Ensure all nodes are initialized
  for (const node of allNodes) {
    if (!inDegree.has(node)) {
      inDegree.set(node, 0)
    }
    if (!adjacencyList.has(node)) {
      adjacencyList.set(node, [])
    }
  }

  // Kahn's algorithm (BFS-based)
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

    for (const neighbor of adjacencyList.get(node) || []) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) {
        queue.push(neighbor)
      }
    }
  }

  // Detect cycle: if not all nodes were processed, a cycle exists
  if (result.length !== allNodes.size) {
    throw new Error("Cycle detected in graph")
  }

  return result
}