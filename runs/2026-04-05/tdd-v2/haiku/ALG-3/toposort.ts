export type NodeId = string | number;

export interface Graph<T = any> {
  nodes: T[];
  edges: Array<[NodeId, NodeId]>;
}

export class CycleError extends Error {
  constructor(message = 'Cycle detected in graph') {
    super(message);
    this.name = 'CycleError';
  }
}

export function toposort<T = any>(
  input: Graph<T> | T[],
  edges?: Array<[NodeId, NodeId]>,
  nodeId?: (node: T, idx: number) => NodeId
): T[] {
  let nodes: T[];
  let edgesList: Array<[NodeId, NodeId]>;

  if (Array.isArray(input)) {
    nodes = input;
    edgesList = edges || [];
  } else {
    nodes = input.nodes;
    edgesList = input.edges;
  }

  const getNodeIdFn = nodeId || ((_, idx) => idx);

  const nodeMap = new Map<NodeId, T>();
  const adj = new Map<NodeId, NodeId[]>();
  const inDegree = new Map<NodeId, number>();

  nodes.forEach((node, idx) => {
    const id = getNodeIdFn(node, idx);
    nodeMap.set(id, node);
    adj.set(id, []);
    inDegree.set(id, 0);
  });

  edgesList.forEach(([from, to]) => {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push(to);
    inDegree.set(to, (inDegree.get(to) || 0) + 1);
  });

  const queue: NodeId[] = [];
  const result: T[] = [];

  inDegree.forEach((degree, id) => {
    if (degree === 0) {
      queue.push(id);
    }
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(nodeMap.get(current)!);

    (adj.get(current) || []).forEach((neighbor) => {
      const newDegree = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    });
  }

  if (result.length !== nodes.length) {
    throw new CycleError();
  }

  return result;
}