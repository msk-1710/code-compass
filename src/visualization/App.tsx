import React, { useState, useMemo, useCallback } from 'react';
import { GraphData, ColorScheme } from './types/graph';
import { GraphVisualization } from './components/GraphVisualization';
import { ControlPanel } from './components/Controls/ControlPanel';
import { FileDetailsPanel } from './components/Panels/FileDetailsPanel';
import { CircularDepsPanel } from './components/Panels/CircularDepsPanel';
import { ExternalDepsPanel } from './components/Panels/ExternalDepsPanel';
import { LegendPanel } from './components/Panels/LegendPanel';
import { Header } from './components/Header/Header';
import { ErrorBoundary } from './components/ErrorBoundary';
import styles from './styles/app.module.css';
import { GraphState } from './types/components';
import { SmartClusterConfig, DEFAULT_CLUSTER_CONFIG } from '../clustering-strategies.js';

export const App: React.FC = () => {
  // Store original file data for rebuilding
  const originalGraphData = useMemo(() => {
    if (typeof window !== 'undefined' && window.__GRAPH_DATA__) {
      return window.__GRAPH_DATA__;
    }
    // Fallback for development
    return {
      nodes: [],
      edges: [],
      circularDependencies: [],
      externalDependencies: new Map()
    };
  }, []);

  // Clustering configuration state
  const [clusteringConfig, setClusteringConfig] = useState<SmartClusterConfig>(DEFAULT_CLUSTER_CONFIG);

  // Rebuild graph when clustering config changes
  const graphData = useMemo(() => {
    // For now, we can't rebuild the graph on the client side because we don't have
    // the raw file data. The graph is pre-built on the server.
    // This is a limitation we'll note in the completion message.
    // In a future enhancement, we could embed the raw file data and rebuild client-side.
    return originalGraphData;
  }, [originalGraphData, clusteringConfig]);

  const projectName = useMemo(() => {
    return (typeof window !== 'undefined' && window.__PROJECT_NAME__) || 'Code Compass';
  }, []);

  const initialColorScheme = useMemo(() => {
    return (typeof window !== 'undefined' && window.__COLOR_SCHEME__) || 'default';
  }, []);

  // Global state
  const [state, setState] = useState<GraphState>({
    colorScheme: initialColorScheme as ColorScheme,
    testsHidden: false,
    externalNodesHidden: false,
    backendOnlyMode: false,
    apiRoutesOnlyMode: false,
    orphansHighlighted: false,
    circularDepsHighlighted: false,
    lineCountThresholdEnabled: false,
    lineCountThreshold: 100,
    dependencyThresholdEnabled: false,
    dependencyThreshold: 20,
    selectedNode: null,
    searchQuery: '',
    legendVisible: false,
    circularDepsPanelVisible: false,
    externalDepsPanelVisible: false,
    nodeSizeMode: 'default',
    selectedPackage: null
  });

  const updateState = (updates: Partial<GraphState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const handleNodeSelect = (nodeId: string | null) => {
    updateState({ selectedNode: nodeId });
  };

  const selectedNodeData = useMemo(() => {
    if (!state.selectedNode) return null;
    return graphData.nodes.find(node => node.id === state.selectedNode) || null;
  }, [state.selectedNode, graphData.nodes]);

  return (
    <div className={styles.app}>
      <Header
        projectName={projectName}
        nodeCount={graphData.nodes.length}
        edgeCount={graphData.edges.length}
        circularDepsCount={graphData.circularDependencies.length}
        legendVisible={state.legendVisible}
        onToggleLegend={() => updateState({ legendVisible: !state.legendVisible })}
        circularDepsVisible={state.circularDepsPanelVisible}
        onToggleCircularDeps={() => updateState({ circularDepsPanelVisible: !state.circularDepsPanelVisible })}
        externalDepsVisible={state.externalDepsPanelVisible}
        onToggleExternalDeps={() => updateState({ externalDepsPanelVisible: !state.externalDepsPanelVisible })}
      />
      
      <ControlPanel
        state={state}
        onStateChange={updateState}
        graphData={graphData}
        clusteringConfig={clusteringConfig}
        onClusteringConfigChange={setClusteringConfig}
      />

      <GraphVisualization
        graphData={graphData}
        state={state}
        onNodeSelect={handleNodeSelect}
      />

      <FileDetailsPanel
        visible={state.selectedNode !== null}
        onClose={() => handleNodeSelect(null)}
        node={selectedNodeData}
      />

      <LegendPanel
        visible={state.legendVisible}
        onClose={() => updateState({ legendVisible: false })}
        colorScheme={state.colorScheme}
        nodes={graphData.nodes}
      />

      <CircularDepsPanel
        visible={state.circularDepsPanelVisible}
        onClose={() => updateState({ circularDepsPanelVisible: false })}
        circularDependencies={graphData.circularDependencies}
        onNodeSelect={handleNodeSelect}
      />

      <ExternalDepsPanel
        visible={state.externalDepsPanelVisible}
        onClose={() => updateState({ externalDepsPanelVisible: false })}
        externalDependencies={graphData.externalDependencies}
        onNodeSelect={handleNodeSelect}
      />
    </div>
  );
};