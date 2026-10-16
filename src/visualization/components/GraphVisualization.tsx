import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  ControlsContainer,
  FullScreenControl,
  SigmaContainer,
  ZoomControl,
  useRegisterEvents,
  useSigma,
  useLoadGraph,
  useCamera,
} from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import { GraphSearch, GraphSearchOption } from "@react-sigma/graph-search";
import "@react-sigma/graph-search/lib/style.css";
import { MiniMap } from "@react-sigma/minimap";
import { MultiDirectedGraph } from "graphology";
import { GraphVisualizationProps } from "../types/components";
import { LayoutsControl } from "./LayoutsControl";
import EdgeLegend from "./EdgeLegend";
import { ErrorBoundary } from "./ErrorBoundary";
import { getNodeColor } from "../utils/colorSchemes";
import styles from "./GraphVisualization.module.css";

// Component to track Sigma instance creation
const SigmaInstanceTracker: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const sigma = useSigma();
  
  useEffect(() => {
    return () => {
    };
  }, [sigma]);
  
  return <>{children}</>;
};

// Component to load graph data into Sigma
const LoadGraph: React.FC<{
  graphData: GraphVisualizationProps["graphData"];
}> = ({ graphData }) => {
  const loadGraph = useLoadGraph();

  useEffect(() => {
    const graph = new MultiDirectedGraph();

    // Add nodes
    graphData.nodes.forEach((node) => {
      // Destructure to exclude 'type' if it exists, as Sigma uses 'type' for renderer selection
      const { type, ...nodeData } = node as any;
      graph.addNode(node.id, {
        ...nodeData,
        originalColor: node.color,
      });
    });

    // Add edges
    graphData.edges.forEach((edge) => {
      try {
        graph.addEdge(edge.source, edge.target, {
          ...edge,
          color: edge.isCircular ? "#e74c3c" : "#666666",
          type: "arrow",
        });
      } catch (e) {
        console.warn("Skipping edge:", edge.id, e);
      }
    });

    // DIAGNOSTIC: Log initial node positions to diagnose layout issue
    const allNodes = graph.nodes();
    const sampleNodes = allNodes.slice(0, 10).map(n => ({
      id: n,
      x: graph.getNodeAttribute(n, 'x'),
      y: graph.getNodeAttribute(n, 'y'),
      size: graph.getNodeAttribute(n, 'size')
    }));
    
    const nodesAtOrigin = allNodes.filter(n => {
      const x = graph.getNodeAttribute(n, 'x');
      const y = graph.getNodeAttribute(n, 'y');
      return (x === 0 && y === 0) || x === undefined || y === undefined;
    }).length;
    
    console.log('[DEBUG] Initial node positions:', {
      totalNodes: graph.order,
      nodesAtOrigin: nodesAtOrigin,
      percentageAtOrigin: ((nodesAtOrigin / graph.order) * 100).toFixed(1) + '%',
      samplePositions: sampleNodes
    });

    loadGraph(graph);
  }, [loadGraph, graphData]);

  return null;
};

// Component to focus on a specific node
const FocusOnNode: React.FC<{ node: string | null; move?: boolean }> = ({
  node,
  move = true,
}) => {
  const sigma = useSigma();
  const { gotoNode } = useCamera();

  useEffect(() => {
    if (!node) return;
    
    const graph = sigma.getGraph();
    
    // Check if node exists before trying to access it
    if (!graph.hasNode(node)) {
      return;
    }
    
    graph.setNodeAttribute(node, "highlighted", true);
    if (move) {
      try {
        gotoNode(node);
      } catch (error) {
      }
    }

    return () => {
      if (graph.hasNode(node)) {
        graph.setNodeAttribute(node, "highlighted", false);
      }
    };
  }, [node, move, sigma, gotoNode]);

  return null;
};

// Component to handle graph events
const GraphEvents: React.FC<{
  onNodeSelect: (nodeId: string | null) => void;
  hoveredStateRef: React.MutableRefObject<{ hoveredNode?: string; hoveredNeighbors?: Set<string> }>;
}> = ({ onNodeSelect, hoveredStateRef }) => {
  const registerEvents = useRegisterEvents();
  const sigma = useSigma();

  useEffect(() => {
    // Get graph inside effect to avoid dependency issues
    const graph = sigma.getGraph();
    
    const hoveredNode = (event: any) => {
      const node = event.node;
      
      // Check if node exists
      if (!graph.hasNode(node)) {
        return;
      }
      
      // Store hovered node in external state
      hoveredStateRef.current.hoveredNode = node;
      hoveredStateRef.current.hoveredNeighbors = new Set(graph.neighbors(node));
      
      // Highlight the hovered node
      graph.setNodeAttribute(node, "highlighted", true);
      
      // Highlight neighbors
      hoveredStateRef.current.hoveredNeighbors.forEach((neighbor) => {
        if (graph.hasNode(neighbor)) {
          graph.setNodeAttribute(neighbor, "highlighted", true);
        }
      });
      
      // Highlight outgoing edges (green) - dependencies
      graph.forEachOutEdge(node, (edge) => {
        graph.setEdgeAttribute(edge, "highlighted", true);
        graph.setEdgeAttribute(edge, "highlightDirection", "outgoing");
      });
      
      // Highlight incoming edges (blue) - dependents
      graph.forEachInEdge(node, (edge) => {
        graph.setEdgeAttribute(edge, "highlighted", true);
        graph.setEdgeAttribute(edge, "highlightDirection", "incoming");
      });
      
      sigma.refresh({ skipIndexation: true });
    };

    const unhoveredNode = () => {
      // Clear hovered state
      hoveredStateRef.current.hoveredNode = undefined;
      hoveredStateRef.current.hoveredNeighbors = undefined;
      
      // Remove all highlights
      graph.forEachNode((node) => {
        graph.setNodeAttribute(node, "highlighted", false);
      });
      
      graph.forEachEdge((edge) => {
        graph.setEdgeAttribute(edge, "highlighted", false);
        graph.removeEdgeAttribute(edge, "highlightDirection");
      });
      
      sigma.refresh({ skipIndexation: true });
    };

    registerEvents({
      clickNode: (event) => {
        const node = event.node;
        // Check if node exists before selecting
        if (graph.hasNode(node)) {
          onNodeSelect(node);
        } else {
          console.warn(`Clicked node "${node}" not found in graph`);
        }
      },
      clickStage: () => {
        onNodeSelect(null);
      },
      enterNode: hoveredNode,
      leaveNode: unhoveredNode,
    });
  }, [registerEvents, onNodeSelect, sigma, hoveredStateRef]);

  return null;
};

// Component to manage graph state using external state object pattern
const GraphStateManager: React.FC<{
  graphData: GraphVisualizationProps["graphData"];
  state: GraphVisualizationProps["state"];
  circularNodeIds: Set<string>;
  circularEdgeIds: Set<string>;
  stateRef: React.MutableRefObject<GraphVisualizationProps["state"]>;
}> = ({ graphData, state, stateRef }) => {
  const sigma = useSigma();
  const graph = sigma.getGraph();

  // Update the state ref and refresh
  useEffect(() => {
    console.log('[DEBUG] GraphStateManager: State changed, calling sigma.refresh()');
    stateRef.current = state;
    // Refresh without reindexing the graph
    sigma.refresh({ skipIndexation: true });
  }, [state, stateRef, sigma]);

  // No need to update colors in graph - reducer handles it dynamically

  return null;
};

// Main component
export const GraphVisualization: React.FC<GraphVisualizationProps> = ({
  graphData,
  state,
  onNodeSelect,
}) => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [focusNode, setFocusNode] = useState<string | null>(null);
  const [searchSelectedNode, setSearchSelectedNode] = useState<string | null>(null);
  
  // Create refs to hold state that reducers can access
  const stateRef = useRef(state);
  const hoveredStateRef = useRef<{ hoveredNode?: string; hoveredNeighbors?: Set<string> }>({});
  
  // Store circular dependency sets in refs to avoid recreating reducers
  const circularNodeIdsRef = useRef<Set<string>>(new Set());
  const circularEdgeIdsRef = useRef<Set<string>>(new Set());
  
  // Update refs when data changes
  useEffect(() => {
    const nodeIds = new Set<string>();
    graphData.circularDependencies.forEach((dep) => {
      dep.cycle.forEach((nodeId) => nodeIds.add(nodeId));
    });
    circularNodeIdsRef.current = nodeIds;
    
    const edgeIds = new Set<string>();
    graphData.circularDependencies.forEach((dep) => {
      for (let i = 0; i < dep.cycle.length - 1; i++) {
        edgeIds.add(`${dep.cycle[i]}-${dep.cycle[i + 1]}`);
      }
    });
    circularEdgeIdsRef.current = edgeIds;
  }, [graphData.circularDependencies]);

  // Create COMPLETELY stable reducer functions with NO dependencies
  // All state is read from refs to prevent recreating these functions
  const nodeReducer = useCallback((node: string, data: any) => {
    const res = { ...data };
    const currentState = stateRef.current;
    const hoverState = hoveredStateRef.current;
    
    // Handle visibility
    if ((currentState.testsHidden && data.isTest) || (currentState.externalNodesHidden && data.isExternal)) {
      res.hidden = true;
      return res;
    }
    
    // Handle package filter - show only nodes from selected package
    if (currentState.selectedPackage && data.package !== currentState.selectedPackage) {
      res.hidden = true;
      return res;
    }
    
    // Handle backend-only mode - show only Node.js framework files
    if (currentState.backendOnlyMode && !data.nodeFramework) {
      res.hidden = true;
      return res;
    }
    
    // Handle API routes only mode - show only files with HTTP methods
    if (currentState.apiRoutesOnlyMode && (!data.httpMethods || data.httpMethods.length === 0)) {
      res.hidden = true;
      return res;
    }
    
    // Scale node sizes based on graph size for better visualization
    // Smaller graphs need smaller nodes to avoid overcrowding
    const nodeCount = graphData.nodes.length;
    const graphSizeScale = nodeCount < 20 ? 0.5 : nodeCount < 50 ? 0.7 : nodeCount < 100 ? 0.85 : 1.0;
    
    // Calculate node size based on mode
    if (currentState.nodeSizeMode === 'lines') {
      // Scale by lines of code (square root scale for better differentiation)
      const minSize = 3;
      const maxSize = 25;
      const sqrtLines = Math.sqrt(data.lines);
      // Normalize to 0-1 range assuming max ~2000 lines (sqrt(2000) ≈ 45)
      const normalized = Math.min(sqrtLines / 30, 1);
      res.size = (minSize + (maxSize - minSize) * normalized) * graphSizeScale;
    } else if (currentState.nodeSizeMode === 'references') {
      // Scale by total references (square root scale)
      const minSize = 3;
      const maxSize = 25;
      const totalRefs = data.imports + data.importedBy;
      const sqrtRefs = Math.sqrt(totalRefs);
      // Normalize to 0-1 range assuming max ~100 refs (sqrt(100) = 10)
      const normalized = Math.min(sqrtRefs / 10, 1);
      res.size = (minSize + (maxSize - minSize) * normalized) * graphSizeScale;
    } else {
      // Use default size from data, scaled by graph size
      res.size = (data.size || 8) * graphSizeScale;
    }
    
    // Dim non-related nodes when hovering (before highlighting check)
    if (hoverState.hoveredNeighbors && !hoverState.hoveredNeighbors.has(node) && hoverState.hoveredNode !== node) {
      res.color = "#b6b6b6";
      res.label = "";
      res.zIndex = 0;
      return res;
    }
    
    // Handle hover highlighting (highest priority)
    if (data.highlighted) {
      res.color = "#3498db";
      res.zIndex = 2;
      return res;
    }
    
    // Handle search highlighting
    if (currentState.searchQuery) {
      const query = currentState.searchQuery.toLowerCase();
      const matches = data.label.toLowerCase().includes(query) || node.toLowerCase().includes(query);
      if (matches) {
        res.color = "#3498db";
        res.zIndex = 1;
        return res;
      }
    }
    
    // Handle line count threshold highlighting
    if (currentState.lineCountThresholdEnabled) {
      if (data.lines >= currentState.lineCountThreshold) {
        res.color = "#ff6b6b";
        res.zIndex = 1;
      } else {
        res.color = "#b6b6b6";
        res.zIndex = 0;
      }
      return res;
    }
    
    // Handle dependency threshold highlighting
    if (currentState.dependencyThresholdEnabled) {
      if (data.importedBy >= currentState.dependencyThreshold) {
        res.color = "#ffd93d";
        res.zIndex = 1;
      } else {
        res.color = "#b6b6b6";
        res.zIndex = 0;
      }
      return res;
    }
    
    // Handle orphan highlighting
    if (currentState.orphansHighlighted) {
      if (data.isOrphan) {
        res.color = "#e74c3c";
        res.zIndex = 1;
      } else {
        res.color = "#b6b6b6";
        res.zIndex = 0;
      }
      return res;
    }
    
    // Handle circular dependency highlighting
    if (currentState.circularDepsHighlighted) {
      if (circularNodeIdsRef.current.has(node)) {
        res.color = "#e67e22";
        res.zIndex = 1;
      } else {
        res.color = "#b6b6b6";
        res.zIndex = 0;
      }
      return res;
    }
    
    // Default: use color based on current color scheme
    res.color = getNodeColor(data, currentState.colorScheme, graphData.nodes);
    res.zIndex = 0;
    return res;
  }, []); // NO dependencies - completely stable!

  const edgeReducer = useCallback((edge: string, data: any) => {
    const res = { ...data };
    const currentState = stateRef.current;
    const hoverState = hoveredStateRef.current;
    
    // Dim non-related edges when hovering (before highlighting check)
    if (hoverState.hoveredNode && !data.highlighted) {
      res.hidden = true;
      return res;
    }
    
    // Handle hover highlighting (highest priority)
    if (data.highlighted) {
      // Keep circular dependencies red even when highlighted
      if (data.isCircular) {
        res.color = "#e74c3c";
      } else if (data.highlightDirection === "outgoing") {
        // Outgoing edges (dependencies) are green
        res.color = "#2ecc71";
      } else if (data.highlightDirection === "incoming") {
        // Incoming edges (dependents) are blue
        res.color = "#3498db";
      } else {
        // Fallback to blue
        res.color = "#3498db";
      }
      res.size = (data.size || 1) * 2;
      return res;
    }
    
    // Handle orphan highlighting
    if (currentState.orphansHighlighted) {
      res.color = "#b6b6b6";
      res.size = 0.5;
      return res;
    }
    
    // Handle circular dependency highlighting
    if (currentState.circularDepsHighlighted) {
      if (circularEdgeIdsRef.current.has(edge) || data.isCircular) {
        res.color = "#e74c3c";
        res.size = (data.size || 1) * 1.5;
      } else {
        res.color = "#b6b6b6";
        res.size = 0.5;
      }
      return res;
    }
    
    // Default: use original color
    res.color = data.isCircular ? "#e74c3c" : "#666666";
    res.size = data.size || 1;
    return res;
  }, []); // NO dependencies - completely stable!

  // Sync selected node with parent
  useEffect(() => {
    setSelectedNode(state.selectedNode);
  }, [state.selectedNode]);

  // GraphSearch value - only for search results, NOT for clicked nodes
  const graphSearchValue = useMemo(() => {
    if (!searchSelectedNode) return null;
    return { type: "nodes" as const, id: searchSelectedNode };
  }, [searchSelectedNode]);

  const onFocus = useCallback((value: GraphSearchOption | null) => {
    if (value === null) setFocusNode(null);
    else if (value.type === "nodes") {
      // Validate node exists before focusing
      const nodeExists = graphData.nodes.some(node => node.id === value.id);
      if (nodeExists) {
        setFocusNode(value.id);
      } else {
        console.warn(`Focus node "${value.id}" not found in graph data`);
      }
    }
  }, [graphData.nodes]);

  const onChange = useCallback(
    (value: GraphSearchOption | null) => {
      if (value === null) {
        setSearchSelectedNode(null);
        setSelectedNode(null);
        onNodeSelect(null);
      } else if (value.type === "nodes") {
        // Set both search selection and actual selection
        setSearchSelectedNode(value.id);
        setSelectedNode(value.id);
        onNodeSelect(value.id);
      }
    },
    [onNodeSelect]
  );

  const postSearchResult = useCallback(
    (options: GraphSearchOption[]): GraphSearchOption[] => {
      return options.length <= 10
        ? options
        : [
            ...options.slice(0, 10),
            {
              type: "message",
              message: (
                <span style={{ textAlign: "center", color: "#999" }}>
                  And {options.length - 10} others
                </span>
              ),
            },
          ];
    },
    []
  );

  // Custom dark hover renderer so hovered/tapped nodes have a sleek dark pill background instead of Sigma's hardcoded white
  const drawCustomNodeHover = useCallback((
    context: CanvasRenderingContext2D,
    data: any,
    settings: any
  ) => {
    const size = settings.labelSize || 13;
    const font = settings.labelFont || "sans-serif";
    const weight = settings.labelWeight || "600";
    context.font = `${weight} ${size}px ${font}`;

    // Dark frosted pill background for hovered node
    context.fillStyle = "rgba(15, 23, 42, 0.95)";
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 2;
    context.shadowBlur = 8;
    context.shadowColor = "rgba(0, 0, 0, 0.6)";

    const PADDING = 3;
    if (typeof data.label === "string" && data.label) {
      const textWidth = context.measureText(data.label).width;
      const boxWidth = Math.round(textWidth + 8);
      const boxHeight = Math.round(size + 2 * PADDING);
      const radius = Math.max(data.size, size / 2) + PADDING;
      const angleRadian = Math.asin(Math.min(boxHeight / 2 / radius, 1));
      const xDeltaCoord = Math.sqrt(Math.max(Math.pow(radius, 2) - Math.pow(boxHeight / 2, 2), 0));

      context.beginPath();
      context.moveTo(data.x + xDeltaCoord, data.y + boxHeight / 2);
      context.lineTo(data.x + radius + boxWidth, data.y + boxHeight / 2);
      context.lineTo(data.x + radius + boxWidth, data.y - boxHeight / 2);
      context.lineTo(data.x + xDeltaCoord, data.y - boxHeight / 2);
      context.arc(data.x, data.y, radius, angleRadian, -angleRadian);
      context.closePath();
      context.fill();

      // Subtle cyan border around hovered label
      context.strokeStyle = "rgba(56, 189, 248, 0.5)";
      context.lineWidth = 1.5;
      context.stroke();
    } else {
      context.beginPath();
      context.arc(data.x, data.y, data.size + PADDING, 0, Math.PI * 2);
      context.closePath();
      context.fill();
    }

    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
    context.shadowBlur = 0;

    // Draw crisp white text
    if (data.label) {
      context.fillStyle = "#ffffff";
      context.font = `${weight} ${size}px ${font}`;
      context.fillText(data.label, data.x + data.size + 4, data.y + size / 3);
    }
  }, []);

  // Memoize settings to prevent SigmaContainer from recreating Sigma instance
  const sigmaSettings = useMemo(() => {
    console.log('[DEBUG] Creating Sigma settings:', {
      nodeCount: graphData.nodes.length,
      edgeCount: graphData.edges.length,
      nodeSizeMode: state.nodeSizeMode
    });
    
    return {
          allowInvalidContainer: false,
          renderEdgeLabels: false,
          defaultNodeColor: "#cccccc",
          defaultEdgeColor: "rgba(148, 163, 184, 0.4)",
          defaultEdgeType: "arrow",
          defaultDrawNodeHover: drawCustomNodeHover,
          labelSize: 13,
          labelWeight: "600",
          labelColor: { color: "#f8fafc" },
          labelRenderedSizeThreshold: 0.5,
          enableEdgeEvents: true,
          nodeReducer,
          edgeReducer,
          // Use screen-based sizing (pixels) instead of position-based for consistent node sizes
          // This prevents nodes from appearing huge when switching between layouts with different coordinate spaces
          itemSizesReference: "screen" as const,
          // Scale nodes with zoom - linear relationship works well with screen-based sizing
          zoomToSizeRatioFunction: (ratio: number) => ratio,
        };
  }, [nodeReducer, edgeReducer, drawCustomNodeHover, graphData.nodes.length, graphData.edges.length, state.nodeSizeMode]);

  return (
    <div className={styles.container} style={{ width: '100%', height: '100vh' }}>
      <SigmaContainer
        settings={sigmaSettings}
        style={{ height: "100%", width: "100%" }}
      >
        <SigmaInstanceTracker>
          <LoadGraph graphData={graphData} />
          <GraphEvents onNodeSelect={onNodeSelect} hoveredStateRef={hoveredStateRef} />
        </SigmaInstanceTracker>
        <GraphStateManager
          graphData={graphData}
          state={state}
          circularNodeIds={circularNodeIdsRef.current}
          circularEdgeIds={circularEdgeIdsRef.current}
          stateRef={stateRef}
        />
        <FocusOnNode node={focusNode} />

        <ControlsContainer position={"bottom-right"}>
          <ZoomControl />
          <FullScreenControl />
          <LayoutsControl />
        </ControlsContainer>

        <ControlsContainer position={"top-right"}>
          <GraphSearch
            type="nodes"
            value={graphSearchValue}
            onFocus={onFocus}
            onChange={onChange}
            postSearchResult={postSearchResult}
          />
        </ControlsContainer>

        <ControlsContainer position={"bottom-left"}>
          <EdgeLegend />
        </ControlsContainer>
      </SigmaContainer>
    </div>
  );
};
