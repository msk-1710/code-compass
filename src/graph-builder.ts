import { FileInfo } from './analyzer.js';
import * as path from 'path';
import {
  SmartClusterConfig,
  DEFAULT_CLUSTER_CONFIG,
  prepareClusteringMetadata,
  getSmartCluster,
  ProjectType
} from './clustering-strategies.js';

export interface CircularDependency {
  cycle: string[];
  severity: number;
}

export type ColorScheme = 'default' | 'nextjs';

export interface GraphData {
  nodes: Array<{
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
    fileType: 'typescript' | 'javascript' | 'typescript-react' | 'javascript-react' | 'test' | 'types' | 'style' | 'config' | 'asset' | 'external';
    nextjsType?: 'page' | 'layout' | 'template' | 'loading' | 'error' | 'not-found' | 'route' | 'middleware' | 'config' | 'api' | 'app-special' | 'pages-special';
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
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    size: number;
    usageCount?: number; // How many times imports from this file are actually used
    isCircular?: boolean;
  }>;
  circularDependencies: CircularDependency[];
  externalDependencies: Map<string, string[]>; // package name -> files that import it
}

/**
 * Gets the full folder hierarchy for a file path
 */
function getFolderHierarchy(filePath: string): string[] {
  const dir = path.dirname(filePath);
  if (dir === '.') return ['root'];
  
  const parts = dir.split(path.sep);
  const hierarchy: string[] = [];
  
  // Build cumulative hierarchy: ['src', 'src/components', 'src/components/ui']
  for (let i = 0; i < parts.length; i++) {
    hierarchy.push(parts.slice(0, i + 1).join(path.sep));
  }
  
  return hierarchy;
}

/**
 * Gets the immediate parent folder for clustering
 */
function getCluster(filePath: string): string {
  const dir = path.dirname(filePath);
  return dir === '.' ? 'root' : dir;
}

/**
 * Converts HSL to hex color
 */
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Gets color based on file type - Default scheme
 */
function getDefaultColor(fileType: FileInfo['fileType']): string {
  switch (fileType) {
    // Core source files - Blue family (cool colors)
    case 'typescript':
      return '#2196f3'; // Blue - Primary TypeScript color
    case 'typescript-react':
      return '#1976d2'; // Darker blue - TSX files
    case 'javascript':
      return '#00bcd4'; // Cyan - JS files
    case 'javascript-react':
      return '#0097a7'; // Darker cyan - JSX files
    case 'types':
      return '#3f51b5'; // Indigo - Type definitions
    
    // Style files - Purple/Pink family
    case 'style':
      return '#9c27b0'; // Purple - CSS/SCSS
    
    // Asset files - Teal
    case 'asset':
      return '#009688'; // Teal - Images, fonts, etc.
    
    // Config files - Brown/Gray
    case 'config':
      return '#795548'; // Brown - Config files
    
    // Special categories - Warm colors (clearly distinct)
    case 'test':
      return '#ff9800'; // Orange - Test files
    case 'external':
      return '#f44336'; // Red - External dependencies
    
    default:
      return '#2196f3'; // Default to TypeScript blue
  }
}

/**
 * Gets color based on Next.js file type, component type, server actions, and Node.js framework
 * Priority order:
 * 1. Server Actions (if present)
 * 2. Node.js framework (if detected)
 * 3. Next.js file type (existing logic)
 * 4. Component type (client/server)
 * 5. Default file type colors
 */
function getNextjsColor(
  fileType: FileInfo['fileType'],
  nextjsType?: FileInfo['nextjsType'],
  componentType?: 'client' | 'server' | 'shared',
  serverActions?: string[],
  nodeFramework?: 'express' | 'nestjs' | 'fastify'
): string {
  // Priority 1: Server Actions (highest priority - action-oriented)
  if (serverActions && serverActions.length > 0) {
    return '#f97316'; // Orange - Server actions
  }
  
  // Priority 2: Node.js framework detection
  if (nodeFramework) {
    switch (nodeFramework) {
      case 'express':
        return '#22c55e'; // Green - Express.js
      case 'nestjs':
        return '#ef4444'; // Red - NestJS
      case 'fastify':
        return '#6b7280'; // Dark gray - Fastify
    }
  }
  
  // Priority 3: Next.js special files get priority colors
  if (nextjsType) {
    switch (nextjsType) {
      case 'page':
        return '#10b981'; // Green - Page components (entry points)
      case 'layout':
        return '#8b5cf6'; // Purple - Layouts (structural)
      case 'template':
        return '#a78bfa'; // Light purple - Templates
      case 'loading':
        return '#06b6d4'; // Cyan - Loading states
      case 'error':
        return '#ef4444'; // Red - Error boundaries
      case 'not-found':
        return '#f97316'; // Orange - 404 pages
      case 'route':
        return '#3b82f6'; // Blue - API routes
      case 'middleware':
        return '#ec4899'; // Pink - Middleware
      case 'config':
        return '#f59e0b'; // Amber - Next.js config
      case 'api':
        return '#6366f1'; // Indigo - Pages Router API
      case 'app-special':
        return '#14b8a6'; // Teal - Metadata files
      case 'pages-special':
        return '#f43f5e'; // Rose - Pages Router special files
      default:
        break;
    }
  }
  
  // Priority 4: Component type (client/server)
  if (componentType) {
    switch (componentType) {
      case 'client':
        return '#60a5fa'; // Light blue - Client components
      case 'server':
        return '#2563eb'; // Darker blue - Server components
      case 'shared':
        // Fall through to default file type colors
        break;
    }
  }
  
  // Priority 5: Fall back to file type colors with Next.js adjustments
  switch (fileType) {
    case 'typescript':
      return '#2563eb'; // Blue - Regular TS files
    case 'typescript-react':
      return '#1d4ed8'; // Darker blue - TSX components
    case 'javascript':
      return '#0ea5e9'; // Sky blue - Regular JS files
    case 'javascript-react':
      return '#0284c7'; // Darker sky - JSX components
    case 'types':
      return '#4f46e5'; // Indigo - Type definitions
    case 'style':
      return '#a855f7'; // Purple - Styles
    case 'asset':
      return '#06b6d4'; // Cyan - Assets
    case 'config':
      return '#78716c'; // Stone - Config files
    case 'test':
      return '#fb923c'; // Orange - Tests
    case 'external':
      return '#dc2626'; // Red - External deps
    default:
      return '#2563eb';
  }
}

/**
 * Gets color based on file type and color scheme
 */
function getFileTypeColor(
  fileType: FileInfo['fileType'],
  nextjsType?: FileInfo['nextjsType'],
  scheme: ColorScheme = 'default',
  componentType?: 'client' | 'server' | 'shared',
  serverActions?: string[],
  nodeFramework?: 'express' | 'nestjs' | 'fastify'
): string {
  if (scheme === 'nextjs') {
    return getNextjsColor(fileType, nextjsType, componentType, serverActions, nodeFramework);
  }
  return getDefaultColor(fileType);
}

/**
 * Detects if a file is a test file based on common patterns
 */
function isTestFile(filePath: string): boolean {
  const testPatterns = [
    /\.test\./i,           // file.test.ts, file.test.js
    /\.spec\./i,           // file.spec.ts, file.spec.js
    /__tests__/i,          // __tests__ folder
    /__test__/i,           // __test__ folder
    /\.test$/i,            // file.test (no extension)
    /\.spec$/i,            // file.spec (no extension)
    /\/tests?\//i,         // /test/ or /tests/ folder
    /\/specs?\//i,         // /spec/ or /specs/ folder
    /-test\./i,            // file-test.ts
    /-spec\./i,            // file-spec.ts
    /\.e2e\./i,            // file.e2e.ts (e2e tests)
    /\.integration\./i,    // file.integration.ts
  ];
  
  return testPatterns.some(pattern => pattern.test(filePath));
}

/**
 * Detects circular dependencies using DFS
 */
function detectCircularDependencies(files: FileInfo[]): CircularDependency[] {
  const cycles: CircularDependency[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const pathStack: string[] = [];
  const seenCycles = new Set<string>(); // Track unique cycles
  
  // Build adjacency list
  const adjacencyList = new Map<string, string[]>();
  for (const file of files) {
    adjacencyList.set(file.path, file.imports);
  }
  
  function dfs(node: string): void {
    visited.add(node);
    recursionStack.add(node);
    pathStack.push(node);
    
    const neighbors = adjacencyList.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStartIndex = pathStack.indexOf(neighbor);
        const cycle = pathStack.slice(cycleStartIndex);
        cycle.push(neighbor); // Complete the cycle
        
        // Create a normalized cycle key to avoid duplicates
        // Sort the cycle to create a canonical representation
        const sortedCycle = [...cycle].sort().join('->');
        
        if (!seenCycles.has(sortedCycle)) {
          seenCycles.add(sortedCycle);
          
          // Calculate severity based on cycle length (shorter = worse)
          const severity = Math.max(1, 10 - (cycle.length - 1));
          
          cycles.push({ cycle, severity });
        }
      }
    }
    
    pathStack.pop();
    recursionStack.delete(node);
  }
  
  // Check all nodes - reset visited for each starting point to find all cycles
  for (const file of files) {
    visited.clear();
    recursionStack.clear();
    pathStack.length = 0;
    dfs(file.path);
  }
  
  return cycles;
}

/**
 * Builds a sigma.js compatible graph from file analysis data
 */
export function buildGraph(
  files: FileInfo[],
  colorScheme: ColorScheme = 'default',
  clusteringConfig?: Partial<SmartClusterConfig>
): GraphData {
  const nodes: GraphData['nodes'] = [];
  const edges: GraphData['edges'] = [];
  
  // Merge with default config
  const config: SmartClusterConfig = {
    ...DEFAULT_CLUSTER_CONFIG,
    ...clusteringConfig
  };
  
  // Prepare clustering metadata (project type detection, density calculation)
  const { projectType, densityMap } = prepareClusteringMetadata(files, config);
  
  // Log detected project type for debugging
  if (config.enableFrameworkDetection && projectType.confidence > 0.7) {
    console.log(`Detected ${projectType.framework} project (confidence: ${projectType.confidence.toFixed(2)})`);
    if (projectType.framework === 'nextjs') {
      if (projectType.hasAppRouter) console.log('  - App Router detected');
      if (projectType.hasPagesRouter) console.log('  - Pages Router detected');
    }
  }
  
  // Create a set of all file paths for quick lookup
  const filePathSet = new Set(files.map(f => f.path));
  
  // Count how many times each file is imported (importedBy count)
  const importedByCount = new Map<string, number>();
  for (const file of files) {
    for (const importPath of file.imports) {
      if (filePathSet.has(importPath)) {
        importedByCount.set(importPath, (importedByCount.get(importPath) || 0) + 1);
      }
    }
  }
  
  // Collect all external dependencies
  const allExternalDeps = new Set<string>();
  for (const file of files) {
    file.externalImports.forEach(dep => allExternalDeps.add(dep));
  }
  
  // Create nodes for project files
  for (const file of files) {
    // Use smart clustering instead of simple directory-based clustering
    const cluster = getSmartCluster(file.path, file, projectType, config, densityMap);
    const color = getFileTypeColor(
      file.fileType,
      file.nextjsType,
      colorScheme,
      file.componentType,
      file.serverActions,
      file.nodeFramework
    );
    
    // Calculate node size based on multiple factors
    // 1. File size (lines of code)
    const sizeScore = Math.sqrt(file.lines / 10);
    
    // 2. Import/export importance (hub detection)
    const importsScore = file.imports.length;
    const importedByScore = importedByCount.get(file.path) || 0;
    const hubScore = (importsScore + importedByScore * 2) * 0.8; // Weight importedBy more
    
    // 3. Complexity indicator (file size in bytes)
    const complexityScore = Math.sqrt(file.size / 1000);
    
    // Combine scores with weights
    const nodeSize = Math.max(8, Math.min(50,
      sizeScore * 0.3 +
      hubScore * 0.5 +
      complexityScore * 0.2
    ));
    
    // Check if file is an orphan (no imports and not imported by anyone)
    // Exclude Next.js special files as they are framework entry points
    const isNextjsEntryPoint = file.nextjsType !== undefined;
    const isOrphan = !isNextjsEntryPoint && file.imports.length === 0 && (importedByCount.get(file.path) || 0) === 0;
    
    nodes.push({
      id: file.path,
      label: path.basename(file.path),
      size: nodeSize,
      x: Math.random() * 1000,
      y: Math.random() * 1000,
      color: color,
      lines: file.lines,
      imports: file.imports.length,
      importedBy: importedByCount.get(file.path) || 0,
      fileSize: file.size,
      cluster: cluster,
      isTest: file.fileType === 'test',
      isOrphan: isOrphan,
      isExternal: false,
      fileType: file.fileType,
      nextjsType: file.nextjsType,
      componentType: file.componentType,
      serverActions: file.serverActions,
      nodeFramework: file.nodeFramework,
      moduleSystem: file.moduleSystem,
      externalDependencies: file.externalImports,
      routeGroup: file.routeGroup,
      dynamicSegments: file.dynamicSegments,
      parallelRoute: file.parallelRoute,
      interceptingRoute: file.interceptingRoute,
      httpMethods: file.httpMethods,
      dynamicImports: file.dynamicImports,
      package: file.package,
      workspace: file.workspace,
    });
  }
  
  // Create nodes for external dependencies
  for (const extDep of allExternalDeps) {
    nodes.push({
      id: `ext:${extDep}`,
      label: extDep,
      size: 15, // Fixed size for external deps
      x: Math.random() * 1000,
      y: Math.random() * 1000,
      color: getFileTypeColor('external', undefined, colorScheme),
      lines: 0,
      imports: 0,
      importedBy: 0,
      fileSize: 0,
      cluster: 'external',
      isTest: false,
      isOrphan: false,
      isExternal: true,
      fileType: 'external',
      externalDependencies: [],
    });
  }
  
  // Detect circular dependencies
  const circularDependencies = detectCircularDependencies(files);
  
  // Create a set of edges that are part of circular dependencies
  const circularEdges = new Set<string>();
  for (const { cycle } of circularDependencies) {
    for (let i = 0; i < cycle.length - 1; i++) {
      circularEdges.add(`${cycle[i]}-${cycle[i + 1]}`);
    }
  }
  
  // Create edges for import relationships (both internal and external)
  for (const file of files) {
    // Internal imports
    for (const [importPath, count] of file.importCount.entries()) {
      if (filePathSet.has(importPath)) {
        const edgeId = `${file.path}-${importPath}`;
        const usageCount = file.importUsage.get(importPath) || 0;
        
        const baseSize = count;
        const usageMultiplier = usageCount > 0 ? Math.log10(usageCount + 1) + 1 : 1;
        const edgeSize = baseSize * usageMultiplier;
        
        edges.push({
          id: edgeId,
          source: file.path,
          target: importPath,
          size: Math.max(1, Math.min(10, edgeSize)),
          usageCount,
          isCircular: circularEdges.has(edgeId),
        });
      }
    }
    
    // External imports - create edges to external dependency nodes
    for (const extDep of file.externalImports) {
      const edgeId = `${file.path}-ext:${extDep}`;
      edges.push({
        id: edgeId,
        source: file.path,
        target: `ext:${extDep}`,
        size: 1,
        usageCount: 0,
        isCircular: false,
      });
    }
  }
  
  // Build external dependencies map (package name -> files that import it)
  const externalDependencies = new Map<string, string[]>();
  for (const file of files) {
    for (const extDep of file.externalImports) {
      if (!externalDependencies.has(extDep)) {
        externalDependencies.set(extDep, []);
      }
      externalDependencies.get(extDep)!.push(file.path);
    }
  }
  
  return { nodes, edges, circularDependencies, externalDependencies };
}