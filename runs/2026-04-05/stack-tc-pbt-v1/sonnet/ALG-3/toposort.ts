export class CycleError extends Error {
  constructor(public readonly cycle: string[]) {
    super(`Cycle detected: ${cycle.join(" → ")}`)
    this.name = "CycleError"
  }
}

export interface Graph {
  nodes: string[]
  edges: Array<[string, string]>
}

export function toposort(graph: Graph): string[] {
  const adjacency = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  for (const node of graph.nodes) {
    if (!adjacency.has(node)) adjacency.set(node, [])
    if (!inDegree.has(node)) inDegree.set(node, 0)
  }

  for (const [u, v] of graph.edges) {
    if (!adjacency.has(u)) adjacency.set(u, [])
    if (!inDegree.has(v)) inDegree.set(v, 0)
    if (!inDegree.has(u)) inDegree.set(u, 0)
    adjacency.get(u)!.push(v)
    inDegree.set(v, (inDegree.get(v) ?? 0) + 1)
  }

  const allNodes = new Set<string>([
    ...graph.nodes,
    ...graph.edges.flatMap(([u, v]) => [u, v]),
  ])

  const queue: string[] = []
  for (const node of allNodes) {
    if ((inDegree.get(node) ?? 0) === 0) {
      queue.push(node)
    }
  }

  queue.sort()

  const result: string[] = []

  while (queue.length > 0) {
    const node = queue.shift()!
    result.push(node)

    const neighbors = adjacency.get(node) ?? []
    const sorted: string[] = []

    for (const neighbor of neighbors) {
      const deg = (inDegree.get(neighbor) ?? 0) - 1
      inDegree.set(neighbor, deg)
      if (deg === 0) {
        sorted.push(neighbor)
      }
    }

    sorted.sort()
    queue.push(...sorted)
  }

  if (result.length !== allNodes.size) {
    const cycle = findCycle(adjacency, allNodes, result)
    throw new CycleError(cycle)
  }

  return result
}

function findCycle(
  adjacency: Map<string, string[]>,
  allNodes: Set<string>,
  sorted: string[]
): string[] {
  const visited = new Set<string>(sorted)
  const remaining = [...allNodes].filter((n) => !visited.has(n))

  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>()
  const parent = new Map<string, string | null>()

  for (const node of allNodes) {
    color.set(node, WHITE)
    parent.set(node, null)
  }

  let cycleStart = ""
  let cycleEnd = ""

  function dfs(u: string): boolean {
    color.set(u, GRAY)
    for (const v of (adjacency.get(u) ?? [])) {
      if (color.get(v) === GRAY) {
        cycleStart = v
        cycleEnd = u
        return true
      }
      if (color.get(v) === WHITE) {
        parent.set(v, u)
        if (dfs(v)) return true
      }
    }
    color.set(u, BLACK)
    return false
  }

  for (const node of remaining) {
    if (color.get(node) === WHITE) {
      if (dfs(node)) break
    }
  }

  if (!cycleStart) return remaining.slice(0, 2)

  const cycle: string[] = []
  let cur: string | null = cycleEnd
  while (cur !== null && cur !== cycleStart) {
    cycle.push(cur)
    cur = parent.get(cur) ?? null
  }
  cycle.push(cycleStart)
  cycle.reverse()
  cycle.push(cycleStart)

  return cycle
}

export function hasCycle(graph: Graph): boolean {
  try {
    toposort(graph)
    return false
  } catch (e) {
    if (e instanceof CycleError) return true
    throw e
  }
}