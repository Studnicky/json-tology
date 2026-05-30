/**
 * graphLayout — deterministic preset-layout positions for Cytoscape.
 *
 * Computes fixed {x,y} positions for every node in a TBox or ABox layer.
 * No Math.random — order derives purely from input plus sorted ids.
 * Guarantees no two nodes share the same position within a layer.
 */

const CELL_W = 240;
const CELL_H = 150;

export interface LayoutPosition {
  x: number;
  y: number;
}

/**
 * Compute deterministic, non-overlapping positions for all nodes in a layer.
 *
 * TBox layer:
 *   - Entity nodes (kind === 'entity') fill the top band, sorted by
 *     subClassOf depth (ascending) then by id. Rows of up to 6 columns.
 *   - Primitive nodes (kind === 'primitive') fill a lower band after a
 *     2-cell gap, ordered by barycenter x of connected entity nodes.
 *     Rows of up to 8 columns.
 *
 * ABox layer:
 *   - Each instance node heads a cluster; its literal members fill a
 *     sub-grid of up to 3 columns below the head.
 *   - Clusters tile left-to-right, up to 4 per row; row height = max
 *     cluster height in that row plus a one-cell gap.
 *
 * Throws if any two positions in the returned map collide (internal
 * no-overlap guarantee).
 */
export function layoutLayer(
  nodes: ReadonlyArray<{ id: string; kind: string }>,
  edges: ReadonlyArray<{ source: string; target: string }>,
  layer: 'tbox' | 'abox'
): Map<string, LayoutPosition> {
  const positions = new Map<string, LayoutPosition>();

  if (layer === 'tbox') {
    layoutTbox(nodes, edges, positions);
  } else {
    layoutAbox(nodes, edges, positions);
  }

  assertNoOverlap(positions);

  return positions;
}

// ---------------------------------------------------------------------------
// TBox layout
// ---------------------------------------------------------------------------

function layoutTbox(
  nodes: ReadonlyArray<{ id: string; kind: string }>,
  edges: ReadonlyArray<{ source: string; target: string }>,
  positions: Map<string, LayoutPosition>
): void {
  const entityNodes = nodes
    .filter((node) => {
      return node.kind === 'entity';
    })
    .map((node) => {
      return node.id;
    });

  const primitiveNodes = nodes
    .filter((node) => {
      return node.kind === 'primitive';
    })
    .map((node) => {
      return node.id;
    });

  const subClassOfEdges = edges.filter((edge) => {
    // Detect subClassOf edges by checking both endpoints are entities
    return entityNodes.includes(edge.source) && entityNodes.includes(edge.target);
  });

  // Compute longest subClassOf chain depth for each entity.
  // A node that is the SOURCE of subClassOf is deeper (child).
  // Roots (no outgoing subClassOf to another entity) get depth 0.
  const depths = computeSubClassOfDepths(entityNodes, subClassOfEdges);

  // Sort entities: ascending depth then ascending id
  const sortedEntities = [...entityNodes].sort((idA, idB) => {
    const depthA = depths.get(idA) ?? 0;
    const depthB = depths.get(idB) ?? 0;

    if (depthA !== depthB) {
      return depthA - depthB;
    }

    return idA < idB ? -1 : idA > idB ? 1 : 0;
  });

  const ENTITY_COLS = 6;

  for (let entityIndex = 0; entityIndex < sortedEntities.length; entityIndex++) {
    const entityId = sortedEntities[entityIndex];
    const col = entityIndex % ENTITY_COLS;
    const row = Math.floor(entityIndex / ENTITY_COLS);

    positions.set(entityId, {
      'x': col * CELL_W,
      'y': row * CELL_H
    });
  }

  const entityRows = Math.ceil(sortedEntities.length / ENTITY_COLS);
  const primitiveStartY = entityRows * CELL_H + 2 * CELL_H;

  // Order primitives by barycenter x of connected entity nodes
  const entityXByid = new Map<string, number>();

  for (const [entityId, pos] of positions) {
    entityXByid.set(entityId, pos.x);
  }

  const primitiveBarycenter = (primitiveId: string): number => {
    const connectedXValues: number[] = [];

    for (const edge of edges) {
      if (edge.source === primitiveId || edge.target === primitiveId) {
        const otherId = edge.source === primitiveId ? edge.target : edge.source;
        const otherX = entityXByid.get(otherId);

        if (otherX !== undefined) {
          connectedXValues.push(otherX);
        }
      }
    }

    if (connectedXValues.length === 0) {
      // No entity connections: sort last by using a very large x + id for stability
      return Number.MAX_SAFE_INTEGER;
    }

    const sumX = connectedXValues.reduce((acc, xVal) => {
      return acc + xVal;
    }, 0);

    return sumX / connectedXValues.length;
  };

  const sortedPrimitives = [...primitiveNodes].sort((idA, idB) => {
    const baryA = primitiveBarycenter(idA);
    const baryB = primitiveBarycenter(idB);

    if (baryA !== baryB) {
      return baryA - baryB;
    }

    return idA < idB ? -1 : idA > idB ? 1 : 0;
  });

  const PRIMITIVE_COLS = 8;

  for (let primitiveIndex = 0; primitiveIndex < sortedPrimitives.length; primitiveIndex++) {
    const primitiveId = sortedPrimitives[primitiveIndex];
    const col = primitiveIndex % PRIMITIVE_COLS;
    const row = Math.floor(primitiveIndex / PRIMITIVE_COLS);

    positions.set(primitiveId, {
      'x': col * CELL_W,
      'y': primitiveStartY + row * CELL_H
    });
  }
}

/**
 * Compute the longest subClassOf chain depth for each entity node.
 * A leaf class (source of no subClassOf edges pointing to another entity)
 * has depth 0. A class that is a direct child of a root has depth 1.
 * We use an iterative memoized DFS to avoid stack overflows on large graphs.
 */
function computeSubClassOfDepths(
  entityIds: string[],
  subClassOfEdges: ReadonlyArray<{ source: string; target: string }>
): Map<string, number> {
  // Build child→parents map (source is child, target is parent)
  const parentsByChild = new Map<string, string[]>();

  for (const entityId of entityIds) {
    parentsByChild.set(entityId, []);
  }

  for (const edge of subClassOfEdges) {
    const parents = parentsByChild.get(edge.source);

    if (parents !== undefined) {
      parents.push(edge.target);
    }
  }

  const depthCache = new Map<string, number>();

  const getDepth = (entityId: string, visiting: Set<string>): number => {
    const cached = depthCache.get(entityId);

    if (cached !== undefined) {
      return cached;
    }

    if (visiting.has(entityId)) {
      // Cycle detected; treat as root
      return 0;
    }

    visiting.add(entityId);
    const parents = parentsByChild.get(entityId) ?? [];

    if (parents.length === 0) {
      depthCache.set(entityId, 0);
      visiting.delete(entityId);

      return 0;
    }

    let maxParentDepth = 0;

    for (const parentId of parents) {
      const parentDepth = getDepth(parentId, visiting);

      if (parentDepth > maxParentDepth) {
        maxParentDepth = parentDepth;
      }
    }

    const depth = maxParentDepth + 1;

    depthCache.set(entityId, depth);
    visiting.delete(entityId);

    return depth;
  };

  for (const entityId of entityIds) {
    getDepth(entityId, new Set());
  }

  return depthCache;
}

// ---------------------------------------------------------------------------
// ABox layout
// ---------------------------------------------------------------------------

function layoutAbox(
  nodes: ReadonlyArray<{ id: string; kind: string }>,
  edges: ReadonlyArray<{ source: string; target: string }>,
  positions: Map<string, LayoutPosition>
): void {
  const instanceIds = nodes
    .filter((node) => {
      return node.kind === 'instance';
    })
    .map((node) => {
      return node.id;
    })
    .sort();

  const literalIds = new Set(
    nodes
      .filter((node) => {
        return node.kind === 'literal';
      })
      .map((node) => {
        return node.id;
      })
  );

  // Build a map from instance id → its owned literal ids (one hop via instanceProperty)
  const literalsByInstance = new Map<string, string[]>();

  for (const instanceId of instanceIds) {
    literalsByInstance.set(instanceId, []);
  }

  const ownedLiterals = new Set<string>();

  for (const edge of edges) {
    if (instanceIds.includes(edge.source) && literalIds.has(edge.target)) {
      const ownedList = literalsByInstance.get(edge.source);

      if (ownedList !== undefined) {
        ownedList.push(edge.target);
        ownedLiterals.add(edge.target);
      }
    }
  }

  // Collect unowned literals (edge case — should not happen)
  const unownedLiterals: string[] = [];

  for (const literalId of literalIds) {
    if (!ownedLiterals.has(literalId)) {
      unownedLiterals.push(literalId);
    }
  }
  unownedLiterals.sort();

  const CLUSTER_COLS = 3;
  const CLUSTERS_PER_ROW = 4;
  const CLUSTER_W = CLUSTER_COLS * CELL_W;

  // Build cluster descriptors
  interface ClusterDescriptor {
    instanceId: string;
    literals: string[];
    clusterHeight: number;
  }

  const clusters: ClusterDescriptor[] = instanceIds.map((instanceId) => {
    const literals = (literalsByInstance.get(instanceId) ?? []).sort();
    const literalRows = Math.ceil(literals.length / CLUSTER_COLS);
    const clusterHeight = (1 + literalRows) * CELL_H;

    return {
      clusterHeight,
      instanceId,
      literals
    };
  });

  // Tile clusters into rows of up to 4
  let currentY = 0;

  for (let clusterIndex = 0; clusterIndex < clusters.length; clusterIndex++) {
    const cluster = clusters[clusterIndex];
    const clusterRow = Math.floor(clusterIndex / CLUSTERS_PER_ROW);
    const clusterCol = clusterIndex % CLUSTERS_PER_ROW;

    // Determine this row's y offset: advance y after each full row
    if (clusterIndex % CLUSTERS_PER_ROW === 0 && clusterIndex > 0) {
      // Compute max cluster height in the previous row
      const rowStart = clusterIndex - CLUSTERS_PER_ROW;
      let maxRowHeight = 0;

      for (let rowCluster = rowStart; rowCluster < clusterIndex; rowCluster++) {
        const rowClusterHeight = clusters[rowCluster].clusterHeight;

        if (rowClusterHeight > maxRowHeight) {
          maxRowHeight = rowClusterHeight;
        }
      }

      currentY += maxRowHeight + CELL_H;
    }

    // We need the actual currentY for this cluster row
    // Recompute by summing all previous row heights
    const clusterOriginY = computeClusterRowOriginY(clusters, clusterRow, CLUSTERS_PER_ROW);
    const clusterOriginX = clusterCol * CLUSTER_W;

    // Head: instance node at top-left of cluster
    positions.set(cluster.instanceId, {
      'x': clusterOriginX,
      'y': clusterOriginY
    });

    // Literals: fill grid below the head
    for (let literalIndex = 0; literalIndex < cluster.literals.length; literalIndex++) {
      const literalId = cluster.literals[literalIndex];
      const literalCol = literalIndex % CLUSTER_COLS;
      const literalRow = Math.floor(literalIndex / CLUSTER_COLS);

      positions.set(literalId, {
        'x': clusterOriginX + literalCol * CELL_W,
        'y': clusterOriginY + (literalRow + 1) * CELL_H
      });
    }
  }

  // Suppress unused variable warning — currentY is a running accumulator
  void currentY;

  // Append unowned literals in a trailing grid below all clusters
  const totalClusterRows = Math.ceil(clusters.length / CLUSTERS_PER_ROW);
  let trailingY = computeTrailingY(clusters, totalClusterRows, CLUSTERS_PER_ROW);

  for (let unownedIndex = 0; unownedIndex < unownedLiterals.length; unownedIndex++) {
    const unownedId = unownedLiterals[unownedIndex];
    const col = unownedIndex % CLUSTER_COLS;
    const row = Math.floor(unownedIndex / CLUSTER_COLS);

    positions.set(unownedId, {
      'x': col * CELL_W,
      'y': trailingY + row * CELL_H
    });
  }

  void trailingY;
}

/**
 * Compute the Y origin for a cluster row given all cluster descriptors.
 * Each row's Y is the sum of all previous rows' max heights plus per-row gaps.
 */
function computeClusterRowOriginY(
  clusters: ReadonlyArray<{ clusterHeight: number }>,
  targetRow: number,
  clustersPerRow: number
): number {
  let originY = 0;

  for (let rowIndex = 0; rowIndex < targetRow; rowIndex++) {
    const rowStartIndex = rowIndex * clustersPerRow;
    const rowEndIndex = Math.min(rowStartIndex + clustersPerRow, clusters.length);
    let maxRowHeight = 0;

    for (let clusterIndex = rowStartIndex; clusterIndex < rowEndIndex; clusterIndex++) {
      const clusterHeight = clusters[clusterIndex].clusterHeight;

      if (clusterHeight > maxRowHeight) {
        maxRowHeight = clusterHeight;
      }
    }

    originY += maxRowHeight + CELL_H;
  }

  return originY;
}

/**
 * Compute the Y coordinate below all cluster rows for the trailing unowned-literal grid.
 */
function computeTrailingY(
  clusters: ReadonlyArray<{ clusterHeight: number }>,
  totalClusterRows: number,
  clustersPerRow: number
): number {
  if (clusters.length === 0) {
    return 0;
  }

  const lastRowOriginY = computeClusterRowOriginY(clusters, totalClusterRows - 1, clustersPerRow);
  const lastRowStart = (totalClusterRows - 1) * clustersPerRow;
  const lastRowEnd = Math.min(lastRowStart + clustersPerRow, clusters.length);
  let lastRowMaxHeight = 0;

  for (let clusterIndex = lastRowStart; clusterIndex < lastRowEnd; clusterIndex++) {
    const clusterHeight = clusters[clusterIndex].clusterHeight;

    if (clusterHeight > lastRowMaxHeight) {
      lastRowMaxHeight = clusterHeight;
    }
  }

  return lastRowOriginY + lastRowMaxHeight + CELL_H;
}

// ---------------------------------------------------------------------------
// No-overlap assertion
// ---------------------------------------------------------------------------

/**
 * Throws if any two nodes in the position map share the same {x,y}.
 */
function assertNoOverlap(positions: Map<string, LayoutPosition>): void {
  const seen = new Map<string, string>();

  for (const [nodeId, pos] of positions) {
    const key = `${pos.x},${pos.y}`;
    const conflictId = seen.get(key);

    if (conflictId !== undefined) {
      throw new Error(
        `graphLayout: position collision at (${pos.x}, ${pos.y}) between "${conflictId}" and "${nodeId}"`
      );
    }

    seen.set(key, nodeId);
  }
}
