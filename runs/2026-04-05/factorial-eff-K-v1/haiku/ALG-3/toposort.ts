export class CycleDetectedError extends Error {
  constructor(message: string = 'Cycle detected in graph') {
    super(message)
    this.name = 'CycleDetectedError'
  }
}

export function topologicalSort<T>(graph: Map<T, T[]>): T[] {
  // Collect all nodes (including those that only appear as targets)
  const allNodes = new Set<T>(graph.keys())
  for (const neighbors of graph.values()) {
    for (const neighbor of neighbors) {
      allNodes.add(neighbor)
    }
  }

  const visited = new Set<T>()
  const recursionStack = new Set<T>()
  const sorted: T[] = []

  const visit = (node: T): void => {
    if (recursionStack.has(node)) {
      throw new CycleDetectedError('Cycle detected in graph')
    }
    if (visited.has(node)) {
      return
    }

    visited.add(node)
    recursionStack.add(node)

    const neighbors = graph.get(node) || []
    for (const neighbor of neighbors) {
      visit(neighbor)
    }

    recursionStack.delete(node)
    sorted.push(node)
  }

  for (const node of allNodes) {
    if (!visited.has(node)) {
      visit(node)
    }
  }

  return sorted.reverse()
}