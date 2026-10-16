import { MultiDirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

function applyCircularLayout(graph: MultiDirectedGraph): void {
  const nodes = graph.nodes();
  const nodeCount = nodes.length;
  
  // Scale radius based on node count for better spacing
  // Small graphs: tighter circles, Large graphs: wider circles
  const baseRadius = nodeCount < 20 ? 150 : nodeCount < 50 ? 200 : nodeCount < 100 ? 300 : 400;
  const radius = Math.max(baseRadius, nodeCount * 5);

  nodes.forEach((node, index) => {
    const angle = (2 * Math.PI * index) / nodeCount;
    graph.setNodeAttribute(node, 'x', radius * Math.cos(angle));
    graph.setNodeAttribute(node, 'y', radius * Math.sin(angle));
  });
  
  console.log('[DEBUG] Circular layout applied:', { nodeCount, radius });
}

export function applyForceAtlas2Layout(graph: MultiDirectedGraph): void {
  // Apply initial circular layout for better starting positions
  applyCircularLayout(graph);

  const nodeCount = graph.order;
  console.log('[DEBUG] Before ForceAtlas2:', { nodeCount });

  // Scale settings based on graph size for better spacing
  // Smaller graphs need tighter spacing, larger graphs need more spread
  const scalingRatio = nodeCount < 20 ? 20 : nodeCount < 50 ? 30 : nodeCount < 100 ? 40 : 50;
  const gravity = nodeCount < 20 ? 2 : nodeCount < 50 ? 1.5 : 1;

  // Apply ForceAtlas2 layout with more iterations for better results
  const settings = forceAtlas2.inferSettings(graph);
  forceAtlas2.assign(graph, {
    iterations: 1000,
    settings: {
      ...settings,
      barnesHutOptimize: true,
      barnesHutTheta: 1,
      scalingRatio, // Dynamic based on graph size
      strongGravityMode: true,
      gravity, // Dynamic based on graph size
      slowDown: 2,
      linLogMode: false,
      adjustSizes: true,
      outboundAttractionDistribution: false
    }
  });

  // Calculate coordinate space bounds for diagnostics
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  graph.forEachNode((node, attrs) => {
    minX = Math.min(minX, attrs.x);
    maxX = Math.max(maxX, attrs.x);
    minY = Math.min(minY, attrs.y);
    maxY = Math.max(maxY, attrs.y);
  });
  
  console.log('[DEBUG] After ForceAtlas2:', {
    coordinateSpace: {
      width: maxX - minX,
      height: maxY - minY
    },
    settings: { scalingRatio, gravity }
  });
}

export function centerGraph(graph: MultiDirectedGraph): void {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  graph.forEachNode((node, attrs) => {
    minX = Math.min(minX, attrs.x);
    maxX = Math.max(maxX, attrs.x);
    minY = Math.min(minY, attrs.y);
    maxY = Math.max(maxY, attrs.y);
  });

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  graph.forEachNode((node, attrs) => {
    graph.setNodeAttribute(node, 'x', attrs.x - centerX);
    graph.setNodeAttribute(node, 'y', attrs.y - centerY);
  });
}

export function calculateNodeSize(
  lines: number,
  imports: number,
  importedBy: number
): number {
  const baseSize = 5;
  const linesWeight = Math.log(lines + 1) * 2;
  const connectionsWeight = (imports + importedBy) * 0.5;
  return Math.max(baseSize, Math.min(30, baseSize + linesWeight + connectionsWeight));
}

export function findCircularPaths(graph: MultiDirectedGraph): string[][] {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]): void {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    graph.forEachOutNeighbor(node, (neighbor) => {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path]);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), neighbor]);
        }
      }
    });

    recursionStack.delete(node);
  }

  graph.forEachNode((node) => {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  });

  return cycles;
}

export function getNodeNeighbors(
  graph: MultiDirectedGraph,
  nodeId: string
): {
  incoming: string[];
  outgoing: string[];
} {
  const incoming: string[] = [];
  const outgoing: string[] = [];

  graph.forEachInNeighbor(nodeId, (neighbor) => {
    incoming.push(neighbor);
  });

  graph.forEachOutNeighbor(nodeId, (neighbor) => {
    outgoing.push(neighbor);
  });

  return { incoming, outgoing };
}

export function highlightNodeAndNeighbors(
  graph: MultiDirectedGraph,
  nodeId: string,
  originalEdgeColors: Map<string, string>
): void {
  graph.setNodeAttribute(nodeId, 'highlighted', true);

  // Highlight outgoing edges (green)
  graph.forEachOutEdge(nodeId, (edge, attrs) => {
    graph.setEdgeAttribute(edge, 'color', attrs.isCircular ? '#e74c3c' : '#2ecc71');
    graph.setNodeAttribute(attrs.target, 'highlighted', true);
  });

  // Highlight incoming edges (blue)
  graph.forEachInEdge(nodeId, (edge, attrs) => {
    graph.setEdgeAttribute(edge, 'color', attrs.isCircular ? '#e74c3c' : '#3498db');
    graph.setNodeAttribute(attrs.source, 'highlighted', true);
  });
}

export function clearNodeHighlight(
  graph: MultiDirectedGraph,
  nodeId: string,
  originalEdgeColors: Map<string, string>
): void {
  graph.removeNodeAttribute(nodeId, 'highlighted');

  graph.forEachEdge(nodeId, (edge) => {
    graph.removeEdgeAttribute(edge, 'highlighted');
    const originalColor = originalEdgeColors.get(edge);
    if (originalColor) {
      graph.setEdgeAttribute(edge, 'color', originalColor);
    }
  });

  graph.forEachNeighbor(nodeId, (neighbor) => {
    graph.removeNodeAttribute(neighbor, 'highlighted');
  });
}

export function filterGraphNodes(
  graph: MultiDirectedGraph,
  filters: {
    hideTests?: boolean;
    hideExternal?: boolean;
    hideOrphans?: boolean;
  }
): void {
  graph.forEachNode((node, attrs) => {
    let hidden = false;

    if (filters.hideTests && attrs.isTest) {
      hidden = true;
    }

    if (filters.hideExternal && attrs.isExternal) {
      hidden = true;
    }

    if (filters.hideOrphans && attrs.isOrphan) {
      hidden = true;
    }

    graph.setNodeAttribute(node, 'hidden', hidden);
  });
}