import { Effect } from "effect"
import { Data } from "effect"

class CycleDetected extends Data.TaggedError("CycleDetected")<{
  nodes: (string | number)[]
}> {}

interface Edge {
  from: string | number
  to: string | number
}

interface Node {
  id: string | number
}

export class CycleDetectedError extends Error {
  constructor(public nodes: (string | number)[] = []) {
    super(`Cycle detected in graph`)
    this.name = "CycleDetectedError"
  }
}

/**
 * Performs topological sort on a DAG using Kahn's algorithm.
 * @param nodes - Array of nodes with id property
 * @param edges - Array of edges with from and to properties
 * @returns Topologically sorted array of node IDs
 * @throws CycleDetectedError if a cycle is detected
 */
export function toposort(
  nodes: Node[],
  edges: Edge[]
): (string | number)[] {
  const effect = Effect.gen(function* () {
    const nodeSet = new Set(nodes.map((n) => n.id))
    const inDegree = new Map<string | number, number>()
    const adjList = new Map<string | number, (string | number)[]>()

    // Initialize
    for (const node of nodes) {
      inDegree.set(node.id, 0)
      adjList.set(node.id, [])
    }

    // Build graph
    for (const edge of edges) {
      if (!nodeSet.has(edge.from) || !nodeSet.has(edge.to)) {
        yield* Effect.die(
          new Error(
            `Edge references non-existent node: ${edge.from} -> ${edge.to}`
          )
        )
      }
      const neighbors = adjList.get(edge.from)!
      neighbors.push(edge.to)
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1)
    }

    // Find nodes with no incoming edges
    const queue: (string | number)[] = []
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId)
      }
    }

    const sorted: (string | number)[] = []

    while (queue.length > 0) {
      const nodeId = queue.shift()!
      sorted.push(nodeId)

      const neighbors = adjList.get(nodeId) || []
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1
        inDegree.set(neighbor, newDegree)
        if (newDegree === 0) {
          queue.push(neighbor)
        }
      }
    }

    // Check for cycles
    if (sorted.length !== nodes.length) {
      const remaining = nodes
        .map((n) => n.id)
        .filter((id) => !sorted.includes(id))
      yield* Effect.fail(new CycleDetected({ nodes: remaining }))
    }

    return sorted
  })

  try {
    return Effect.runSync(effect)
  } catch (e) {
    if (e instanceof CycleDetected) {
      throw new CycleDetectedError(e.nodes)
    }
    throw e instanceof Error ? e : new Error(String(e))
  }
}

/**
 * Async version of topological sort
 * @param nodes - Array of nodes with id property
 * @param edges - Array of edges with from and to properties
 * @returns Promise resolving to topologically sorted array of node IDs
 * @throws CycleDetectedError if a cycle is detected
 */
export async function toposortAsync(
  nodes: Node[],
  edges: Edge[]
): Promise<(string | number)[]> {
  const effect = Effect.gen(function* () {
    const nodeSet = new Set(nodes.map((n) => n.id))
    const inDegree = new Map<string | number, number>()
    const adjList = new Map<string | number, (string | number)[]>()

    for (const node of nodes) {
      inDegree.set(node.id, 0)
      adjList.set(node.id, [])
    }

    for (const edge of edges) {
      if (!nodeSet.has(edge.from) || !nodeSet.has(edge.to)) {
        yield* Effect.die(
          new Error(
            `Edge references non-existent node: ${edge.from} -> ${edge.to}`
          )
        )
      }
      const neighbors = adjList.get(edge.from)!
      neighbors.push(edge.to)
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1)
    }

    const queue: (string | number)[] = []
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId)
      }
    }

    const sorted: (string | number)[] = []

    while (queue.length > 0) {
      const nodeId = queue.shift()!
      sorted.push(nodeId)

      const neighbors = adjList.get(nodeId) || []
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1
        inDegree.set(neighbor, newDegree)
        if (newDegree === 0) {
          queue.push(neighbor)
        }
      }
    }

    if (sorted.length !== nodes.length) {
      const remaining = nodes
        .map((n) => n.id)
        .filter((id) => !sorted.includes(id))
      yield* Effect.fail(new CycleDetected({ nodes: remaining }))
    }

    return sorted
  })

  try {
    return await Effect.runPromise(effect)
  } catch (e) {
    if (e instanceof CycleDetected) {
      throw new CycleDetectedError(e.nodes)
    }
    throw e instanceof Error ? e : new Error(String(e))
  }
}