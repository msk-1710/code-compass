export type ColorScheme = 'default' | 'nextjs' | 'framework' | 'architecture' | 'module-system' | 'monorepo' | 'test-coverage';

export type FileType = 
  | 'typescript' 
  | 'javascript' 
  | 'typescript-react' 
  | 'javascript-react' 
  | 'test' 
  | 'types' 
  | 'style' 
  | 'config' 
  | 'asset' 
  | 'external';

export type NextjsType = 
  | 'page' 
  | 'layout' 
  | 'template' 
  | 'loading' 
  | 'error' 
  | 'not-found' 
  | 'route' 
  | 'middleware' 
  | 'config' 
  | 'api' 
  | 'app-special' 
  | 'pages-special';

export interface GraphNode {
  id: string;
  label: string;
  size: number;
  x: number;
  y: number;
  color: string;
  lines: number;
  imports: number;
  importedBy: number;
  fileSize: number;
  cluster: string;
  isTest: boolean;
  isOrphan: boolean;
  isExternal: boolean;
  fileType: FileType;
  nextjsType?: NextjsType;
  componentType?: 'client' | 'server' | 'shared';
  serverActions?: string[];
  nodeFramework?: 'express' | 'nestjs' | 'fastify';
  moduleSystem?: 'commonjs' | 'esm' | 'mixed';
  externalDependencies: string[];
  routeGroup?: string;
  dynamicSegments?: Array<{ name: string; type: 'single' | 'catch-all' | 'optional-catch-all' }>;
  parallelRoute?: string;
  interceptingRoute?: { type: 'same-level' | 'one-up' | 'two-up' | 'root'; target?: string };
  httpMethods?: string[];
  dynamicImports?: { count: number; modules: string[] };
  package?: string;
  workspace?: { type: string; packages?: string[]; resolvedPackages?: string[] };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  size: number;
  usageCount?: number;
  isCircular?: boolean;
}

export interface CircularDependency {
  cycle: string[];
  severity: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  circularDependencies: CircularDependency[];
  externalDependencies: Map<string, string[]>;
}

export interface EmbeddedData {
  graphData: GraphData;
  projectName: string;
  colorScheme: ColorScheme;
}

// Extend Window interface for embedded data
declare global {
  interface Window {
    __GRAPH_DATA__: GraphData;
    __PROJECT_NAME__: string;
    __COLOR_SCHEME__: ColorScheme;
  }
}

export {};