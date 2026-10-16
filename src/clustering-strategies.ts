import * as path from 'path';
import { FileInfo } from './analyzer.js';

/**
 * Project type detection result
 */
export interface ProjectType {
  framework: 'nextjs' | 'react' | 'vue' | 'angular' | 'svelte' | 'generic';
  hasAppRouter?: boolean; // Next.js App Router
  hasPagesRouter?: boolean; // Next.js Pages Router
  confidence: number; // 0-1 score
}

/**
 * Smart clustering configuration
 */
export interface SmartClusterConfig {
  enableFrameworkDetection: boolean;
  enableDensityClustering: boolean;
  enableModuleDetection: boolean;
  enableArchitecturalLayers: boolean;
  densityThreshold: number; // Files per folder before subdivision
  clusteringPriority: ('framework' | 'density' | 'directory' | 'module' | 'layer')[];
}

/**
 * Default clustering configuration
 */
export const DEFAULT_CLUSTER_CONFIG: SmartClusterConfig = {
  enableFrameworkDetection: true,
  enableDensityClustering: true,
  enableModuleDetection: false,
  enableArchitecturalLayers: false,
  densityThreshold: 15,
  clusteringPriority: ['framework', 'density', 'directory']
};

/**
 * Detects the project type based on file structure and patterns
 */
export function detectProjectType(files: FileInfo[]): ProjectType {
  const filePaths = files.map(f => f.path);
  const fileSet = new Set(filePaths);
  
  // Next.js detection
  const hasNextConfig = fileSet.has('next.config.js') || fileSet.has('next.config.ts') || 
                        fileSet.has('next.config.mjs') || fileSet.has('next.config.cjs');
  const hasAppDir = filePaths.some(p => p.startsWith('app/') || p.startsWith('app\\'));
  const hasPagesDir = filePaths.some(p => p.startsWith('pages/') || p.startsWith('pages\\'));
  const hasNextjsFiles = files.some(f => f.nextjsType !== undefined);
  
  if (hasNextConfig || hasNextjsFiles) {
    return {
      framework: 'nextjs',
      hasAppRouter: hasAppDir,
      hasPagesRouter: hasPagesDir,
      confidence: hasNextConfig ? 1.0 : 0.8
    };
  }
  
  // Vue detection
  const hasVueFiles = filePaths.some(p => p.endsWith('.vue'));
  const hasVueConfig = fileSet.has('vue.config.js') || fileSet.has('vite.config.ts') || fileSet.has('vite.config.js');
  const hasNuxtConfig = fileSet.has('nuxt.config.js') || fileSet.has('nuxt.config.ts');
  
  if (hasVueFiles || hasNuxtConfig) {
    return {
      framework: 'vue',
      confidence: hasNuxtConfig ? 1.0 : hasVueFiles ? 0.9 : 0.7
    };
  }
  
  // Angular detection
  const hasAngularJson = fileSet.has('angular.json');
  const hasAngularFiles = filePaths.some(p => p.includes('.component.') || p.includes('.module.') || p.includes('.service.'));
  
  if (hasAngularJson || hasAngularFiles) {
    return {
      framework: 'angular',
      confidence: hasAngularJson ? 1.0 : 0.8
    };
  }
  
  // Svelte detection
  const hasSvelteFiles = filePaths.some(p => p.endsWith('.svelte'));
  const hasSvelteConfig = fileSet.has('svelte.config.js') || fileSet.has('svelte.config.ts');
  
  if (hasSvelteFiles || hasSvelteConfig) {
    return {
      framework: 'svelte',
      confidence: hasSvelteConfig ? 1.0 : 0.9
    };
  }
  
  // React detection (fallback for non-framework React apps)
  const hasReactFiles = files.some(f => f.fileType === 'typescript-react' || f.fileType === 'javascript-react');
  const hasReactPackage = files.some(f => f.externalImports.includes('react'));
  
  if (hasReactFiles || hasReactPackage) {
    return {
      framework: 'react',
      confidence: 0.7
    };
  }
  
  // Generic project
  return {
    framework: 'generic',
    confidence: 1.0
  };
}

/**
 * Gets Next.js specific cluster for a file
 */
function getNextjsCluster(filePath: string, file: FileInfo, projectType: ProjectType): string | null {
  // App Router structure
  if (projectType.hasAppRouter && (filePath.startsWith('app/') || filePath.startsWith('app\\'))) {
    const parts = filePath.split(/[/\\]/);
    
    // Special Next.js files get their own semantic clusters
    if (file.nextjsType) {
      switch (file.nextjsType) {
        case 'page':
          return 'app/pages';
        case 'layout':
          return 'app/layouts';
        case 'template':
          return 'app/templates';
        case 'loading':
          return 'app/loading-states';
        case 'error':
          return 'app/error-boundaries';
        case 'not-found':
          return 'app/not-found';
        case 'route':
          return 'app/api-routes';
        case 'middleware':
          return 'middleware';
        case 'app-special':
          return 'app/metadata';
        default:
          break;
      }
    }
    
    // Group by route segments (first 2 levels)
    if (parts.length > 2) {
      return `app/${parts[1]}`;
    }
    return 'app/root';
  }
  
  // Pages Router structure
  if (projectType.hasPagesRouter && (filePath.startsWith('pages/') || filePath.startsWith('pages\\'))) {
    if (file.nextjsType === 'api') {
      return 'pages/api';
    }
    if (file.nextjsType === 'pages-special') {
      return 'pages/special';
    }
    
    const parts = filePath.split(/[/\\]/);
    if (parts.length > 2) {
      return `pages/${parts[1]}`;
    }
    return 'pages/root';
  }
  
  // Middleware
  if (file.nextjsType === 'middleware') {
    return 'middleware';
  }
  
  // Config files
  if (file.nextjsType === 'config') {
    return 'config';
  }
  
  return null;
}

/**
 * Gets React specific cluster for a file
 */
function getReactCluster(filePath: string, file: FileInfo): string | null {
  const dir = path.dirname(filePath);
  const parts = dir.split(path.sep);
  
  // Common React patterns
  if (parts.includes('components')) {
    const componentIdx = parts.indexOf('components');
    if (parts.length > componentIdx + 1) {
      return `components/${parts[componentIdx + 1]}`;
    }
    return 'components';
  }
  
  if (parts.includes('hooks')) {
    return 'hooks';
  }
  
  if (parts.includes('contexts') || parts.includes('context')) {
    return 'contexts';
  }
  
  if (parts.includes('utils') || parts.includes('helpers')) {
    return 'utils';
  }
  
  if (parts.includes('services') || parts.includes('api')) {
    return 'services';
  }
  
  if (parts.includes('store') || parts.includes('redux') || parts.includes('state')) {
    return 'state-management';
  }
  
  return null;
}

/**
 * Gets Vue specific cluster for a file
 */
function getVueCluster(filePath: string, file: FileInfo): string | null {
  const dir = path.dirname(filePath);
  const parts = dir.split(path.sep);
  
  // Nuxt.js patterns
  if (parts.includes('pages')) {
    return 'pages';
  }
  
  if (parts.includes('layouts')) {
    return 'layouts';
  }
  
  if (parts.includes('middleware')) {
    return 'middleware';
  }
  
  if (parts.includes('plugins')) {
    return 'plugins';
  }
  
  if (parts.includes('store')) {
    return 'store';
  }
  
  // Vue common patterns
  if (parts.includes('components')) {
    const componentIdx = parts.indexOf('components');
    if (parts.length > componentIdx + 1) {
      return `components/${parts[componentIdx + 1]}`;
    }
    return 'components';
  }
  
  if (parts.includes('composables')) {
    return 'composables';
  }
  
  if (parts.includes('utils')) {
    return 'utils';
  }
  
  return null;
}

/**
 * Gets framework-specific cluster for a file
 */
function getFrameworkCluster(filePath: string, file: FileInfo, projectType: ProjectType): string | null {
  switch (projectType.framework) {
    case 'nextjs':
      return getNextjsCluster(filePath, file, projectType);
    case 'react':
      return getReactCluster(filePath, file);
    case 'vue':
      return getVueCluster(filePath, file);
    default:
      return null;
  }
}

/**
 * Calculates folder density (number of files per folder)
 */
function calculateFolderDensity(files: FileInfo[]): Map<string, number> {
  const densityMap = new Map<string, number>();
  
  for (const file of files) {
    const dir = path.dirname(file.path);
    densityMap.set(dir, (densityMap.get(dir) || 0) + 1);
  }
  
  return densityMap;
}

/**
 * Gets semantic subdivision for dense folders
 */
function getSemanticSubdivision(filePath: string, file: FileInfo, folderPath: string): string {
  const basename = path.basename(filePath, path.extname(filePath));
  
  // Test files
  if (file.fileType === 'test') {
    return `${folderPath}/tests`;
  }
  
  // Type definitions
  if (file.fileType === 'types') {
    return `${folderPath}/types`;
  }
  
  // Style files
  if (file.fileType === 'style') {
    return `${folderPath}/styles`;
  }
  
  // Config files
  if (file.fileType === 'config') {
    return `${folderPath}/config`;
  }
  
  // React components (files with JSX/TSX)
  if (file.fileType === 'typescript-react' || file.fileType === 'javascript-react') {
    // Check if it's a component file (capitalized)
    if (basename[0] === basename[0].toUpperCase()) {
      return `${folderPath}/components`;
    }
  }
  
  // Hooks (files starting with 'use')
  if (basename.startsWith('use') && basename[3] === basename[3].toUpperCase()) {
    return `${folderPath}/hooks`;
  }
  
  // Utils/helpers
  if (basename.includes('util') || basename.includes('helper') || basename.includes('lib')) {
    return `${folderPath}/utils`;
  }
  
  // Services/API
  if (basename.includes('service') || basename.includes('api') || basename.includes('client')) {
    return `${folderPath}/services`;
  }
  
  // Constants
  if (basename.includes('constant') || basename.includes('config') || basename === 'index') {
    return `${folderPath}/core`;
  }
  
  // Default: keep in original folder
  return folderPath;
}

/**
 * Gets density-based cluster with semantic subdivision
 */
function getDensityCluster(
  filePath: string,
  file: FileInfo,
  densityMap: Map<string, number>,
  threshold: number
): string | null {
  const dir = path.dirname(filePath);
  const density = densityMap.get(dir) || 0;
  
  // If folder exceeds threshold, subdivide semantically
  if (density > threshold) {
    return getSemanticSubdivision(filePath, file, dir);
  }
  
  return null;
}

/**
 * Gets the simple directory-based cluster (fallback)
 */
function getDirectoryCluster(filePath: string): string {
  const dir = path.dirname(filePath);
  return dir === '.' ? 'root' : dir;
}

/**
 * Main smart clustering function that orchestrates all strategies
 */
export function getSmartCluster(
  filePath: string,
  file: FileInfo,
  projectType: ProjectType,
  config: SmartClusterConfig,
  densityMap: Map<string, number>
): string {
  // Try each strategy in priority order
  for (const strategy of config.clusteringPriority) {
    let cluster: string | null = null;
    
    switch (strategy) {
      case 'framework':
        if (config.enableFrameworkDetection) {
          cluster = getFrameworkCluster(filePath, file, projectType);
        }
        break;
        
      case 'density':
        if (config.enableDensityClustering) {
          cluster = getDensityCluster(filePath, file, densityMap, config.densityThreshold);
        }
        break;
        
      case 'directory':
        cluster = getDirectoryCluster(filePath);
        break;
        
      case 'module':
        // Module detection not implemented yet
        break;
        
      case 'layer':
        // Architectural layer detection not implemented yet
        break;
    }
    
    if (cluster !== null) {
      return cluster;
    }
  }
  
  // Fallback to directory-based clustering
  return getDirectoryCluster(filePath);
}

/**
 * Prepares clustering by calculating necessary metadata
 */
export function prepareClusteringMetadata(
  files: FileInfo[],
  config: SmartClusterConfig
): {
  projectType: ProjectType;
  densityMap: Map<string, number>;
} {
  const projectType = config.enableFrameworkDetection 
    ? detectProjectType(files)
    : { framework: 'generic' as const, confidence: 1.0 };
    
  const densityMap = config.enableDensityClustering
    ? calculateFolderDensity(files)
    : new Map<string, number>();
  
  return { projectType, densityMap };
}