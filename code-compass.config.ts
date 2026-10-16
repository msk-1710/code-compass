import { SmartClusterConfig } from './src/clustering-strategies.js';

/**
 * Code Compass Configuration
 * 
 * This file defines the default settings for Code Compass.
 * CLI arguments will override these defaults.
 */

export interface CodeCompassConfig {
  /**
   * Color scheme for the visualization
   * - 'default': Generic color scheme for all projects
   * - 'nextjs': Optimized colors for Next.js projects
   */
  colorScheme: 'default' | 'nextjs';
  
  /**
   * Whether to ignore common build directories
   * (dist, build, .next, out, node_modules, etc.)
   */
  ignoreBuildDirs: boolean;
  
  /**
   * Smart clustering configuration
   */
  clustering: SmartClusterConfig;
  
  /**
   * Output file name (relative to current working directory)
   */
  outputFile: string;
}

export type VisualizerConfig = CodeCompassConfig;

/**
 * Default configuration
 */
export const defaultConfig: CodeCompassConfig = {
  colorScheme: 'default',
  ignoreBuildDirs: false,
  clustering: {
    enableFrameworkDetection: true,
    enableDensityClustering: true,
    enableModuleDetection: false,
    enableArchitecturalLayers: false,
    densityThreshold: 15,
    clusteringPriority: ['framework', 'density', 'directory']
  },
  outputFile: 'code-compass.html'
};

/**
 * Load user configuration from code-compass.config.ts (or visualizer.config.ts) in the project root
 * Falls back to default config if not found
 */
export async function loadConfig(projectRoot: string): Promise<CodeCompassConfig> {
  const possiblePaths = [
    `${projectRoot}/code-compass.config.ts`,
    `${projectRoot}/visualizer.config.ts`
  ];

  for (const configPath of possiblePaths) {
    try {
      const userConfig = await import(configPath);
      
      // Merge user config with defaults
      return {
        ...defaultConfig,
        ...userConfig.default,
        clustering: {
          ...defaultConfig.clustering,
          ...(userConfig.default?.clustering || {})
        }
      };
    } catch (error) {
      // Continue to next path
      continue;
    }
  }

  return defaultConfig;
}