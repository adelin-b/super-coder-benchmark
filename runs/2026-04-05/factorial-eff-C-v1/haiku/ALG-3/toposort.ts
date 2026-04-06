import { Effect, Data } from "effect"

// Domain error
class CycleDetected extends Data.TaggedError("CycleDetected")<{
  message: string
}> {}

export interface Edge<T> {
  from: T
  to: T
}

export interface ToposortResult<T> {
  sorted: T[]
}

export function toposort<T extends string | number>(
  nodes: T[],
  edges: Edge<T>[]
): ToposortResult<T> {
  try {
    return Effect.runSync(toposortEffect(nodes, edges))
  } catch (e) {
    if (e instanceof Error) {
      throw e
    }
    throw new Error("Unknown error in toposort")
  }
}

function toposortEffect<T extends string | number>(
  nodes: T[],
  edges: Edge<T>[]
) {
  return Effect.gen(function* () {
    // Validate edges reference existing nodes
    const nodeSet = new Set(nodes)
    for (const edge of edges) {
      if (!nodeSet.has(edge.from) || !nodeSet.has(edge.to)) {
        yield* Effect.fail(
          new CycleDetected({
            message: `Edge references unknown node`,
          })
        )
      }
    }

    const inDegree = new Map<T, number>()
    const adj = new Map<T, T[]>()

    // Initialize graph structures
    for (const node of nodes) {
      inDegree.set(node, 0)
      adj.set(node, [])
    }

    // Build adjacency list with deduplication
    const edgeSet = new Set<string>()
    for (const edge of edges) {
      const key = `${edge.from}→${edge.to}`
      if (edgeSet.has(key)) {
        continue // Skip duplicate edges
      }
      edgeSet.add(key)

      // Self-loop is a cycle
      if (edge.from === edge.to) {
        yield* Effect.fail(
          new CycleDetected({
            message: `Self-loop detected on node`,
          })
        )
      }

      adj.get(edge.from)!.push(edge.to)
      const currentInDegree = inDegree.get(edge.to)!
      inDegree.set(edge.to, currentInDegree + 1)
    }

    // Kahn's algorithm: process nodes with in-degree 0
    const queue: T[] = []
    for (const node of nodes) {
      if (inDegree.get(node) === 0) {
        queue.push(node)
      }
    }

    const sorted: T[] = []
    while (queue.length > 0) {
      const node = queue.shift()!
      sorted.push(node)

      const neighbors = adj.get(node)!
      for (const neighbor of neighbors) {
        const degree = inDegree.get(neighbor)!
        inDegree.set(neighbor, degree - 1)
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor)
        }
      }
    }

    // Cycle detection: if not all nodes were processed, there's a cycle
    if (sorted.length !== nodes.length) {
      yield* Effect.fail(
        new CycleDetected({
          message: `Cycle detected in graph`,
        })
      )
    }

    return { sorted }
  })
}