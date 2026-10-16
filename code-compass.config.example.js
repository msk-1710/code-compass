/**
 * Example Code Compass Configuration
 * 
 * Copy this file to code-compass.config.js in your project root
 * and customize the settings for your project.
 */

export default {
  /**
   * Color scheme for the visualization
   * - 'default': Generic color scheme for all projects
   * - 'nextjs': Optimized colors for Next.js projects
   */
  colorScheme: 'default',
  
  /**
   * Whether to ignore common build directories
   * (dist, build, .next, out, node_modules, etc.)
   */
  ignoreBuildDirs: true,
  
  /**
   * Smart clustering configuration
   */
  clustering: {
    /**
     * Enable framework-specific clustering (Next.js, React, Vue, etc.)
     * Automatically detects your framework and groups files accordingly
     */
    enableFrameworkDetection: true,
    
    /**
     * Enable density-based clustering
     * Subdivides folders with many files into semantic groups
     */
    enableDensityClustering: true,
    
    /**
     * Enable module-based clustering (experimental)
     * Groups files by logical modules
     */
    enableModuleDetection: false,
    
    /**
     * Enable architectural layer detection (experimental)
     * Groups files by architectural layers (presentation, business logic, data)
     */
    enableArchitecturalLayers: false,
    
    /**
     * Number of files per folder before subdivision
     * Lower values create more granular clusters
     */
    densityThreshold: 15,
    
    /**
     * Priority order for clustering strategies
     * First matching strategy wins
     */
    clusteringPriority: ['framework', 'density', 'directory']
  },
  
  /**
   * Output file name (relative to current working directory)
   */
  outputFile: 'code-compass.html'
};