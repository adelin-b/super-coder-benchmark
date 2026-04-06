export function toposort<T>(
  nodes: T[],
  edges: Array<[T, T]>
): T[] {
  if (!nodes) {
    throw new Error('Nodes must be defined');
  }
  if (!edges) {
    throw new Error('Edges must be defined');
  }

  const nodeSet = new Set(nodes);
  if (nodeSet.size !== nodes.length) {
    throw new Error('Duplicate nodes in graph');
  }

  const adj = new Map<T, T[]>();
  const inDegree = new Map<T, number>();

  for (const node of nodes) {
    adj.set(node, []);
    inDegree.set(node, 0);
  }

  for (const [u, v] of edges) {
    if (!nodeSet.has(u)) {
      throw new Error('Invalid edge: source node not in graph');
    }
    if (!nodeSet.has(v)) {
      throw new Error('Invalid edge: target node not in graph');
    }
    adj.get(u)!.push(v);
    inDegree.set(v, inDegree.get(v)! + 1);
  }

  const queue: T[] = [];
  for (const node of nodes) {
    if (inDegree.get(node) === 0) {
      queue.push(node);
    }
  }

  const result: T[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    result.push(u);

    for (const v of adj.get(u)!) {
      inDegree.set(v, inDegree.get(v)! - 1);
      if (inDegree.get(v) === 0) {
        queue.push(v);
      }
    }
  }

  if (result.length !== nodes.length) {
    throw new Error('Cycle detected in graph');
  }

  return result;
}

export function hasCycle<T>(
  nodes: T[],
  edges: Array<[T, T]>
): boolean {
  if (!nodes) {
    throw new Error('Nodes must be defined');
  }
  if (!edges) {
    return false;
  }

  const nodeSet = new Set(nodes);
  if (nodeSet.size !== nodes.length) {
    throw new Error('Duplicate nodes in graph');
  }

  const adj = new Map<T, T[]>();
  for (const node of nodes) {
    adj.set(node, []);
  }

  for (const [u, v] of edges) {
    if (!nodeSet.has(u)) {
      throw new Error('Invalid edge: source node not in graph');
    }
    if (!nodeSet.has(v)) {
      throw new Error('Invalid edge: target node not in graph');
    }
    adj.get(u)!.push(v);
  }

  const visited = new Set<T>();
  const recStack = new Set<T>();

  const dfs = (node: T): boolean => {
    visited.add(node);
    recStack.add(node);

    for (const neighbor of adj.get(node)!) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) {
          return true;
        }
      } else if (recStack.has(neighbor)) {
        return true;
      }
    }

    recStack.delete(node);
    return false;
  };

  for (const node of nodes) {
    if (!visited.has(node)) {
      if (dfs(node)) {
        return true;
      }
    }
  }

  return false;
}