import { GraphData, ColorScheme, GraphNode } from './graph';
import { SmartClusterConfig } from '../../clustering-strategies.js';

export type NodeSizeMode = 'default' | 'lines' | 'references';

export interface GraphState {
  colorScheme: ColorScheme;
  testsHidden: boolean;
  externalNodesHidden: boolean;
  backendOnlyMode: boolean;
  apiRoutesOnlyMode: boolean;
  orphansHighlighted: boolean;
  circularDepsHighlighted: boolean;
  lineCountThresholdEnabled: boolean;
  lineCountThreshold: number;
  dependencyThresholdEnabled: boolean;
  dependencyThreshold: number;
  selectedNode: string | null;
  searchQuery: string;
  legendVisible: boolean;
  circularDepsPanelVisible: boolean;
  externalDepsPanelVisible: boolean;
  nodeSizeMode: NodeSizeMode;
  selectedPackage: string | null;
}

export interface ControlPanelProps {
  state: GraphState;
  onStateChange: (updates: Partial<GraphState>) => void;
  graphData: GraphData;
  clusteringConfig: SmartClusterConfig;
  onClusteringConfigChange: (config: SmartClusterConfig) => void;
}

export interface GraphVisualizationProps {
  graphData: GraphData;
  state: GraphState;
  onNodeSelect: (nodeId: string | null) => void;
}

export interface PanelProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
}