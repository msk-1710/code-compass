#!/usr/bin/env node

import { analyzeProject, FileInfo } from './analyzer.js';
import { buildGraph } from './graph-builder.js';
import { generateHTML } from './html-generator.js';
import { SmartClusterConfig } from './clustering-strategies.js';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  colorScheme: 'default' as 'default' | 'nextjs',
  ignoreBuildDirs: false,
  clustering: {
    enableFrameworkDetection: true,
    enableDensityClustering: true,
    enableModuleDetection: false,
    enableArchitecturalLayers: false,
    densityThreshold: 15,
    clusteringPriority: ['framework', 'density', 'directory'] as ('framework' | 'density' | 'directory' | 'module' | 'layer')[]
  },
  outputFile: 'code-compass.html'
};

/**
 * Load user configuration from code-compass.config.js in the project root
 */
async function loadUserConfig(projectRoot: string): Promise<Partial<typeof DEFAULT_CONFIG>> {
  const configPaths = [
    path.join(projectRoot, 'code-compass.config.js'),
    path.join(projectRoot, 'code-compass.config.ts'),
    path.join(projectRoot, 'code-compass.config.mjs'),
    path.join(projectRoot, 'visualizer.config.js'),
    path.join(projectRoot, 'visualizer.config.ts'),
    path.join(projectRoot, 'visualizer.config.mjs')
  ];
  
  for (const configPath of configPaths) {
    try {
      const stats = await fs.stat(configPath);
      if (stats.isFile()) {
        console.log(`Loading config from: ${path.basename(configPath)}`);
        const config = await import(configPath);
        return config.default || config;
      }
    } catch (error) {
      // Config file not found, try next
      continue;
    }
  }
  
  return {};
}

/**
 * Display help message
 */
function showHelp() {
  console.log('Usage: code-compass <directory-path> [options]');
  console.log('');
  console.log('Options:');
  console.log('  --ignore-builds                    Ignore common build directories');
  console.log('  --color-scheme <scheme>            Color scheme: default or nextjs');
  console.log('  --output <file>                    Output file name (default: code-compass.html)');
  console.log('');
  console.log('Clustering Options:');
  console.log('  --no-framework-detection           Disable framework-specific clustering');
  console.log('  --no-density-clustering            Disable density-based clustering');
  console.log('  --enable-module-detection          Enable module-based clustering');
  console.log('  --enable-architectural-layers      Enable architectural layer detection');
  console.log('  --density-threshold <number>       Files per folder before subdivision (default: 15)');
  console.log('');
  console.log('Examples:');
  console.log('  code-compass ./my-project');
  console.log('  code-compass . --color-scheme nextjs --ignore-builds');
  console.log('  code-compass ./src --density-threshold 20 --no-framework-detection');
  console.log('');
  console.log('Configuration:');
  console.log('  Create a code-compass.config.js file in your project root to set defaults.');
  console.log('  CLI arguments will override config file settings.');
}

/**
 * Main CLI function
 */
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    
    // Show help if requested
    if (args.includes('--help') || args.includes('-h')) {
      showHelp();
      process.exit(0);
    }
    
    let targetDir: string | undefined;
    let cliOverrides: {
      colorScheme?: 'default' | 'nextjs';
      ignoreBuildDirs?: boolean;
      outputFile?: string;
      clustering?: Partial<SmartClusterConfig>;
    } = {
      clustering: {}
    };

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--ignore-builds') {
        cliOverrides.ignoreBuildDirs = true;
      } else if (arg === '--color-scheme' || arg === '--colors') {
        const scheme = args[i + 1];
        if (scheme === 'nextjs' || scheme === 'default') {
          cliOverrides.colorScheme = scheme;
          i++;
        } else {
          console.error(`Invalid color scheme: ${scheme}. Use 'default' or 'nextjs'`);
          process.exit(1);
        }
      } else if (arg === '--output' || arg === '-o') {
        cliOverrides.outputFile = args[i + 1];
        i++;
      } else if (arg === '--no-framework-detection') {
        cliOverrides.clustering!.enableFrameworkDetection = false;
      } else if (arg === '--no-density-clustering') {
        cliOverrides.clustering!.enableDensityClustering = false;
      } else if (arg === '--enable-module-detection') {
        cliOverrides.clustering!.enableModuleDetection = true;
      } else if (arg === '--enable-architectural-layers') {
        cliOverrides.clustering!.enableArchitecturalLayers = true;
      } else if (arg === '--density-threshold') {
        const threshold = parseInt(args[i + 1], 10);
        if (isNaN(threshold) || threshold < 1) {
          console.error(`Invalid density threshold: ${args[i + 1]}. Must be a positive number.`);
          process.exit(1);
        }
        cliOverrides.clustering!.densityThreshold = threshold;
        i++;
      } else if (!arg.startsWith('--')) {
        targetDir = arg;
      }
    }

    // Check if directory argument was provided
    if (!targetDir) {
      console.error('Error: No directory specified\n');
      showHelp();
      process.exit(1);
    }

    // Resolve to absolute path
    const absolutePath = path.resolve(targetDir);

    // Check if directory exists
    try {
      const stats = await fs.stat(absolutePath);
      if (!stats.isDirectory()) {
        console.error(`Error: ${targetDir} is not a directory`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`Error: Directory ${targetDir} does not exist`);
      process.exit(1);
    }

    // Load user config from project root
    const userConfig = await loadUserConfig(absolutePath);
    
    // Merge configs: DEFAULT_CONFIG < userConfig < cliOverrides
    const config = {
      ...DEFAULT_CONFIG,
      ...userConfig,
      ...cliOverrides,
      clustering: {
        ...DEFAULT_CONFIG.clustering,
        ...(userConfig.clustering || {}),
        ...(cliOverrides.clustering || {})
      }
    };

    console.log(`\nAnalyzing project: ${absolutePath}`);
    console.log(`Color scheme: ${config.colorScheme}`);
    console.log(`Ignore build dirs: ${config.ignoreBuildDirs}`);
    console.log(`\nClustering configuration:`);
    console.log(`  Framework detection: ${config.clustering.enableFrameworkDetection}`);
    console.log(`  Density clustering: ${config.clustering.enableDensityClustering}`);
    console.log(`  Density threshold: ${config.clustering.densityThreshold}`);
    console.log(`  Module detection: ${config.clustering.enableModuleDetection}`);
    console.log(`  Architectural layers: ${config.clustering.enableArchitecturalLayers}`);
    console.log('');

    // Analyze the project
    const files: FileInfo[] = await analyzeProject(absolutePath, {
      ignoreBuildDirs: config.ignoreBuildDirs
    });
    console.log(`Found ${files.length} files`);

    // Build the graph data with clustering config
    const graphData = buildGraph(files, config.colorScheme, config.clustering);
    console.log(`Built graph with ${graphData.nodes.length} nodes and ${graphData.edges.length} edges`);

    // Generate HTML visualization
    const projectName = path.basename(absolutePath);
    const html = await generateHTML(graphData, projectName, config.colorScheme);

    // Write HTML to output file
    const outputPath = path.join(process.cwd(), config.outputFile);
    await fs.writeFile(outputPath, html, 'utf-8');

    console.log(`\n✓ Visualization generated successfully!`);
    console.log(`Output: ${outputPath}`);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Execute main function
main();