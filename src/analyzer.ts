import { promises as fs } from 'fs';
import * as path from 'path';
import { minimatch } from 'minimatch';

interface PathMapping {
  prefix: string;
  paths: string[];
}

interface TsConfig {
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
}

export interface FileInfo {
  path: string;
  size: number;
  lines: number;
  imports: string[];
  importCount: Map<string, number>;
  externalImports: string[]; // External package names (e.g., 'react', 'lodash')
  importUsage: Map<string, number>; // File path -> total usage count of imports from that file
  fileType: 'typescript' | 'javascript' | 'typescript-react' | 'javascript-react' | 'test' | 'types' | 'style' | 'config' | 'asset' | 'external';
  nextjsType?: 'page' | 'layout' | 'template' | 'loading' | 'error' | 'not-found' | 'route' | 'middleware' | 'config' | 'api' | 'app-special' | 'pages-special';
  componentType?: 'client' | 'server' | 'shared';
  serverActions?: string[];
  nodeFramework?: 'express' | 'nestjs' | 'fastify';
  moduleSystem?: 'commonjs' | 'esm' | 'mixed';
  routeGroup?: string;
  dynamicSegments?: Array<{ name: string; type: 'single' | 'catch-all' | 'optional-catch-all' }>;
  parallelRoute?: string;
  interceptingRoute?: { type: 'same-level' | 'one-up' | 'two-up' | 'root'; target?: string };
  httpMethods?: string[];
  dynamicImports?: { count: number; modules: string[] };
  workspace?: { type: 'pnpm' | 'npm' | 'yarn' | 'lerna' | 'turborepo' | 'nx'; packages?: string[]; resolvedPackages?: string[] };
  package?: string; // Which monorepo package this file belongs to
  isSharedLibrary?: boolean;
  importedByPackages?: string[];
  environmentVariables?: { variables: string[]; count: number };
  middleware?: { type: 'nextjs' | 'express' | 'nestjs'; middlewares: string[] };
}

/**
 * Detects React component type based on 'use client' or 'use server' directives
 * Checks the first few lines of the file (before imports) for directives
 */
export function detectReactComponentType(content: string): 'client' | 'server' | 'shared' | null {
  // Remove comments first
  const cleanContent = content
    .replace(/\/\/.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

  // Get first 10 lines to check for directives (before imports typically)
  const lines = cleanContent.split('\n').slice(0, 10);
  const firstLines = lines.join('\n');

  // Check for 'use client' directive at file level
  if (/['"]use client['"]/.test(firstLines)) {
    return 'client';
  }

  // Check for 'use server' directive at file level
  if (/['"]use server['"]/.test(firstLines)) {
    return 'server';
  }

  // If no directive found, it's a shared component (can run on both)
  // Return null to indicate no specific directive
  return null;
}

/**
 * Detects server actions in the file content
 * Looks for 'use server' directives inside function bodies and async function exports
 */
export function detectServerActions(content: string): string[] {
  const serverActions: string[] = [];

  // Remove comments first
  const cleanContent = content
    .replace(/\/\/.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

  // Pattern 1: export async function with 'use server' inside
  // Matches: export async function actionName() { 'use server' ... }
  const exportAsyncRegex = /export\s+async\s+function\s+(\w+)\s*\([^)]*\)\s*\{[^}]*['"]use server['"]/g;
  let match: RegExpExecArray | null;
  while ((match = exportAsyncRegex.exec(cleanContent)) !== null) {
    serverActions.push(match[1]);
  }

  // Pattern 2: async function with 'use server' (not exported directly)
  // Matches: async function actionName() { 'use server' ... }
  const asyncRegex = /(?:^|\s)async\s+function\s+(\w+)\s*\([^)]*\)\s*\{[^}]*['"]use server['"]/g;
  while ((match = asyncRegex.exec(cleanContent)) !== null) {
    const actionName = match[1];
    // Avoid duplicates from export async function
    if (!serverActions.includes(actionName)) {
      serverActions.push(actionName);
    }
  }

  // Pattern 3: const/let/var with arrow function and 'use server'
  // Matches: export const action = async () => { 'use server' ... }
  const arrowRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*async\s*\([^)]*\)\s*=>\s*\{[^}]*['"]use server['"]/g;
  while ((match = arrowRegex.exec(cleanContent)) !== null) {
    serverActions.push(match[1]);
  }

  return serverActions;
}

/**
 * Detects Node.js framework being used in the file
 * Checks for Express.js, NestJS, and Fastify patterns
 */
export function detectNodeFramework(content: string): 'express' | 'nestjs' | 'fastify' | null {
  // Remove comments first
  const cleanContent = content
    .replace(/\/\/.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

  // Check for NestJS decorators (highest priority as they're most specific)
  const nestjsPatterns = [
    /@Controller\s*\(/,
    /@Injectable\s*\(/,
    /@Module\s*\(/,
    /@Get\s*\(/,
    /@Post\s*\(/,
    /@Put\s*\(/,
    /@Delete\s*\(/,
    /@Patch\s*\(/,
  ];
  if (nestjsPatterns.some(pattern => pattern.test(cleanContent))) {
    return 'nestjs';
  }

  // Check if file imports from React/Next.js (to avoid false positives)
  const hasReactImports = /from\s+['"]react['"]/.test(cleanContent) ||
    /from\s+['"]next\//.test(cleanContent) ||
    /from\s+['"]react-/.test(cleanContent);

  // Check for Fastify patterns - prioritize strong evidence first
  const strongFastifyPatterns = [
    /from\s+['"]fastify['"]/,
    /require\s*\(\s*['"]fastify['"]\s*\)/,
    /fastify\s*\(\s*\)/,
    /fastify\./,
  ];

  if (strongFastifyPatterns.some(pattern => pattern.test(cleanContent))) {
    return 'fastify';
  }

  // Only check for .register() if NOT a React file (to avoid React Hook Form false positives)
  if (!hasReactImports) {
    const registerPatterns = [
      /fastify\.register\s*\(/,
      /app\.register\s*\(/,
      /server\.register\s*\(/,
    ];
    if (registerPatterns.some(pattern => pattern.test(cleanContent))) {
      return 'fastify';
    }
  }

  // Check if file imports from Next.js (to avoid false positives)
  const hasNextJsImports = /from\s+['"]next\//.test(cleanContent);

  // If it's a Next.js file, require stronger Express evidence
  if (hasNextJsImports) {
    // Only match if we see actual express imports or very specific patterns
    const strongExpressPatterns = [
      /from\s+['"]express['"]/,
      /require\s*\(\s*['"]express['"]\s*\)/,
      /express\s*\(\s*\)/,
    ];
    if (strongExpressPatterns.some(pattern => pattern.test(cleanContent))) {
      return 'express';
    }
  } else {
    // For non-Next.js files, use broader patterns
    const expressPatterns = [
      /express\s*\(\s*\)/,
      /app\.get\s*\(/,
      /app\.post\s*\(/,
      /app\.put\s*\(/,
      /app\.delete\s*\(/,
      /app\.patch\s*\(/,
      /app\.use\s*\(/,
      /express\.Router\s*\(\s*\)/,  // More specific - requires express. prefix
      /new\s+Router\s*\(/,           // More specific - requires new keyword
      /from\s+['"]express['"]/,
      /require\s*\(\s*['"]express['"]\s*\)/,
    ];
    if (expressPatterns.some(pattern => pattern.test(cleanContent))) {
      return 'express';
    }
  }

  return null;
}

/**
 * Detects the module system being used in the file
 * Checks for CommonJS (require/module.exports) vs ES Modules (import/export)
 */
export function detectModuleSystem(content: string): 'commonjs' | 'esm' | 'mixed' | null {
  // Remove comments first
  const cleanContent = content
    .replace(/\/\/.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

  // Check for CommonJS patterns
  const hasCommonJS = /(?:^|\s)(?:require\s*\(|module\.exports|exports\.)/.test(cleanContent);

  // Check for ES Module patterns
  const hasESM = /(?:^|\s)(?:import\s+|export\s+)/.test(cleanContent);

  if (hasCommonJS && hasESM) {
    return 'mixed';
  } else if (hasESM) {
    return 'esm';
  } else if (hasCommonJS) {
    return 'commonjs';
  }

  return null;
}

/**
 * Detects route groups in Next.js App Router paths
 * Route groups are directories with parentheses: (name)
 * Examples: (auth), (marketing), (dashboard)
 * They organize routes without affecting the URL structure
 *
 * @param filePath - The file path to analyze
 * @returns The route group name (without parentheses) or null if not in a route group
 */
export function detectRouteGroup(filePath: string): string | null {
  // Normalize path separators to forward slashes
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Match route group pattern: (groupName)
  // Look for directories wrapped in parentheses
  const routeGroupRegex = /\/\(([^)]+)\)\//g;
  const matches = [...normalizedPath.matchAll(routeGroupRegex)];

  if (matches.length > 0) {
    // Return the last (most specific) route group if multiple exist
    return matches[matches.length - 1][1];
  }

  return null;
}

/**
 * Detects dynamic route segments in Next.js paths
 * Supports:
 * - Single dynamic segments: [slug]
 * - Catch-all segments: [...slug]
 * - Optional catch-all segments: [[...slug]]
 *
 * @param filePath - The file path to analyze
 * @returns Array of dynamic segment information
 */
export function detectDynamicSegments(filePath: string): Array<{ name: string; type: 'single' | 'catch-all' | 'optional-catch-all' }> {
  const segments: Array<{ name: string; type: 'single' | 'catch-all' | 'optional-catch-all' }> = [];

  // Normalize path separators to forward slashes
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Split path into segments
  const pathSegments = normalizedPath.split('/');

  for (const segment of pathSegments) {
    // Optional catch-all: [[...slug]]
    const optionalCatchAllMatch = segment.match(/^\[\[\.\.\.([^\]]+)\]\]$/);
    if (optionalCatchAllMatch) {
      segments.push({
        name: optionalCatchAllMatch[1],
        type: 'optional-catch-all'
      });
      continue;
    }

    // Catch-all: [...slug]
    const catchAllMatch = segment.match(/^\[\.\.\.([^\]]+)\]$/);
    if (catchAllMatch) {
      segments.push({
        name: catchAllMatch[1],
        type: 'catch-all'
      });
      continue;
    }

    // Single dynamic segment: [slug]
    const singleMatch = segment.match(/^\[([^\]]+)\]$/);
    if (singleMatch) {
      segments.push({
        name: singleMatch[1],
        type: 'single'
      });
    }
  }

  return segments;
}

/**
 * Detects parallel routes in Next.js App Router
 * Parallel routes are marked with @name (e.g., @modal, @sidebar)
 * They allow rendering multiple pages in the same layout simultaneously
 *
 * @param filePath - The file path to analyze
 * @returns The parallel route slot name (without @) or null
 */
export function detectParallelRoute(filePath: string): string | null {
  // Normalize path separators to forward slashes
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Match parallel route pattern: @slotName
  // Look for directories starting with @
  const parallelRouteRegex = /\/@([^/]+)\//g;
  const matches = [...normalizedPath.matchAll(parallelRouteRegex)];

  if (matches.length > 0) {
    // Return the last (most specific) parallel route if multiple exist
    return matches[matches.length - 1][1];
  }

  return null;
}

/**
 * Detects intercepting routes in Next.js App Router
 * Intercepting routes allow intercepting navigation to show content in a modal/overlay
 * Patterns:
 * - (.) - same level
 * - (..) - one level up
 * - (..)(..) or (...) - two levels up
 * - (.....) - root level
 *
 * @param filePath - The file path to analyze
 * @returns Intercepting route information or null
 */
export function detectInterceptingRoute(filePath: string): { type: 'same-level' | 'one-up' | 'two-up' | 'root'; target?: string } | null {
  // Normalize path separators to forward slashes
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Split path into segments
  const pathSegments = normalizedPath.split('/');

  for (let i = 0; i < pathSegments.length; i++) {
    const segment = pathSegments[i];

    // Root level: (....)
    if (segment === '(....)') {
      const target = pathSegments.slice(i + 1).join('/');
      return {
        type: 'root',
        target: target || undefined
      };
    }

    // Two levels up: (...) or (..)(..)
    if (segment === '(...)' || segment === '(..)(..)') {
      const target = pathSegments.slice(i + 1).join('/');
      return {
        type: 'two-up',
        target: target || undefined
      };
    }

    // One level up: (..)
    if (segment === '(..)') {
      const target = pathSegments.slice(i + 1).join('/');
      return {
        type: 'one-up',
        target: target || undefined
      };
    }

    // Same level: (.)
    if (segment === '(.)') {
      const target = pathSegments.slice(i + 1).join('/');
      return {
        type: 'same-level',
        target: target || undefined
      };
    }
  }

  return null;
}

/**
 * Detects HTTP method handlers in API routes
 * Works for both App Router (route.ts) and Pages Router (api/*.ts)
 * Looks for exported functions: GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD
 *
 * @param content - The file content to analyze
 * @returns Array of detected HTTP methods
 */
export function detectHTTPMethods(content: string): string[] {
  const methods: string[] = [];
  const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

  // Remove comments first
  const cleanContent = content
    .replace(/\/\/.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

  for (const method of httpMethods) {
    // Pattern 1: export async function GET(...)
    const asyncFunctionPattern = new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(`, 'g');
    if (asyncFunctionPattern.test(cleanContent)) {
      methods.push(method);
      continue;
    }

    // Pattern 2: export function GET(...)
    const functionPattern = new RegExp(`export\\s+function\\s+${method}\\s*\\(`, 'g');
    if (functionPattern.test(cleanContent)) {
      methods.push(method);
      continue;
    }

    // Pattern 3: export const GET = async (...) =>
    const constAsyncArrowPattern = new RegExp(`export\\s+const\\s+${method}\\s*=\\s*async\\s*\\(`, 'g');
    if (constAsyncArrowPattern.test(cleanContent)) {
      methods.push(method);
      continue;
    }

    // Pattern 4: export const GET = (...) =>
    const constArrowPattern = new RegExp(`export\\s+const\\s+${method}\\s*=\\s*\\(`, 'g');
    if (constArrowPattern.test(cleanContent)) {
      methods.push(method);
      continue;
    }

    // Pattern 5: export const GET = function(...)
    const constFunctionPattern = new RegExp(`export\\s+const\\s+${method}\\s*=\\s*function\\s*\\(`, 'g');
    if (constFunctionPattern.test(cleanContent)) {
      methods.push(method);
    }
  }

  return methods;
}

/**
 * Tracks dynamic imports in a file
 * Counts total dynamic imports and identifies which modules are dynamically imported
 *
 * @param content - The file content to analyze
 * @returns Object containing count and array of dynamically imported modules
 */
export function trackDynamicImports(content: string): { count: number; modules: string[] } {
  const modules: string[] = [];

  // Remove comments first
  const cleanContent = content
    .replace(/\/\/.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

  // Pattern: import("path") or import('path')
  // Matches: import("./module"), import('../utils'), import("react")
  const dynamicImportRegex = /import\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
  let match: RegExpExecArray | null;

  while ((match = dynamicImportRegex.exec(cleanContent)) !== null) {
    const modulePath = match[2];
    modules.push(modulePath);
  }

  return {
    count: modules.length,
    modules
  };
}

/**
 * Workspace information interface
 */
export interface WorkspaceInfo {
  type: 'pnpm' | 'npm' | 'yarn' | 'lerna' | 'turborepo' | 'nx' | null;
  packages?: string[];  // Glob patterns from config
  resolvedPackages?: string[];  // Actual package directories
}

/**
 * Resolves glob patterns to actual package directories
 * Handles patterns like apps/*, libs/*, and negation patterns
 *
 * @param patterns - Array of glob patterns
 * @param projectRoot - The root directory of the project
 * @returns Array of resolved package directory paths
 */
async function resolveGlobPatterns(patterns: string[], projectRoot: string): Promise<string[]> {
  const resolvedPackages = new Set<string>();
  const negationPatterns: string[] = [];
  const inclusionPatterns: string[] = [];

  // Separate negation patterns from inclusion patterns
  for (const pattern of patterns) {
    if (pattern.startsWith('!')) {
      negationPatterns.push(pattern.substring(1));
    } else {
      inclusionPatterns.push(pattern);
    }
  }

  // Process inclusion patterns
  for (const pattern of inclusionPatterns) {
    try {
      // Read all directories in the project root
      const entries = await fs.readdir(projectRoot, { withFileTypes: true });

      // Normalize pattern for cross-platform compatibility
      const normalizedPattern = pattern.replace(/\\/g, '/');

      // Check if pattern contains wildcards
      if (normalizedPattern.includes('*')) {
        // For patterns like 'apps/*' or 'packages/*'
        const baseDir = normalizedPattern.split('/*')[0];
        const basePath = path.join(projectRoot, baseDir);

        try {
          const subEntries = await fs.readdir(basePath, { withFileTypes: true });

          for (const entry of subEntries) {
            if (entry.isDirectory()) {
              const fullPath = path.join(baseDir, entry.name);
              const normalizedPath = fullPath.replace(/\\/g, '/');

              // Check if this path matches the pattern
              if (minimatch(normalizedPath, normalizedPattern)) {
                // Check if it has a package.json
                const packageJsonPath = path.join(projectRoot, fullPath, 'package.json');
                try {
                  await fs.access(packageJsonPath);
                  resolvedPackages.add(fullPath);
                } catch {
                  // No package.json, skip
                }
              }
            }
          }
        } catch {
          // Base directory doesn't exist, skip
        }
      } else {
        // Direct path without wildcards
        const packagePath = path.join(projectRoot, pattern);
        try {
          const stat = await fs.stat(packagePath);
          if (stat.isDirectory()) {
            const packageJsonPath = path.join(packagePath, 'package.json');
            try {
              await fs.access(packageJsonPath);
              resolvedPackages.add(pattern.replace(/\\/g, '/'));
            } catch {
              // No package.json, skip
            }
          }
        } catch {
          // Path doesn't exist, skip
        }
      }
    } catch (error) {
      console.error(`Error resolving pattern ${pattern}:`, error);
    }
  }

  // Filter out packages matching negation patterns
  const filteredPackages = Array.from(resolvedPackages).filter(pkg => {
    const normalizedPkg = pkg.replace(/\\/g, '/');
    return !negationPatterns.some(negPattern => minimatch(normalizedPkg, negPattern));
  });

  return filteredPackages.sort();
}

/**
 * Detects monorepo workspace configuration
 * Checks for pnpm, npm/yarn workspaces, Lerna, Turborepo, and Nx
 * Resolves glob patterns to actual package directories
 *
 * @param projectRoot - The root directory of the project
 * @returns Workspace information including type, patterns, and resolved packages
 */
export async function detectWorkspace(projectRoot: string): Promise<WorkspaceInfo> {
  try {
    // Check for pnpm-workspace.yaml
    const pnpmWorkspacePath = path.join(projectRoot, 'pnpm-workspace.yaml');
    try {
      const pnpmContent = await fs.readFile(pnpmWorkspacePath, 'utf-8');
      // Parse YAML manually for packages array
      const packagesMatch = pnpmContent.match(/packages:\s*\n((?:\s+-\s+.+\n?)+)/);
      if (packagesMatch) {
        const packages = packagesMatch[1]
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('-'))
          .map(line => line.substring(1).trim().replace(/['"]/g, ''));
        const resolvedPackages = await resolveGlobPatterns(packages, projectRoot);
        return { type: 'pnpm', packages, resolvedPackages };
      }
      return { type: 'pnpm', packages: [], resolvedPackages: [] };
    } catch {
      // pnpm-workspace.yaml not found, continue
    }

    // Check for npm/yarn workspaces in package.json
    const packageJsonPath = path.join(projectRoot, 'package.json');
    try {
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageContent);

      if (packageJson.workspaces) {
        const packages = Array.isArray(packageJson.workspaces)
          ? packageJson.workspaces
          : packageJson.workspaces.packages || [];

        // Determine if it's npm or yarn based on lock file
        const resolvedPackages = await resolveGlobPatterns(packages, projectRoot);

        // Determine if it's npm or yarn based on lock file
        try {
          await fs.access(path.join(projectRoot, 'yarn.lock'));
          return { type: 'yarn', packages, resolvedPackages };
        } catch {
          return { type: 'npm', packages, resolvedPackages };
        }
      }
    } catch {
      // package.json not found or invalid, continue
    }

    // Check for lerna.json
    const lernaPath = path.join(projectRoot, 'lerna.json');
    try {
      const lernaContent = await fs.readFile(lernaPath, 'utf-8');
      const lernaJson = JSON.parse(lernaContent);
      const packages = lernaJson.packages || ['packages/*'];
      const resolvedPackages = await resolveGlobPatterns(packages, projectRoot);
      return { type: 'lerna', packages, resolvedPackages };
    } catch {
      // lerna.json not found, continue
    }

    // Check for turbo.json
    const turboPath = path.join(projectRoot, 'turbo.json');
    try {
      await fs.access(turboPath);
      // Turborepo doesn't define packages in turbo.json, check package.json workspaces
      try {
        const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageContent);
        const packages = Array.isArray(packageJson.workspaces)
          ? packageJson.workspaces
          : packageJson.workspaces?.packages || [];
        const resolvedPackages = await resolveGlobPatterns(packages, projectRoot);
        return { type: 'turborepo', packages, resolvedPackages };
      } catch {
        return { type: 'turborepo', packages: [], resolvedPackages: [] };
      }
    } catch {
      // turbo.json not found, continue
    }

    // Check for nx.json
    const nxPath = path.join(projectRoot, 'nx.json');
    try {
      await fs.access(nxPath);
      // Nx uses workspace.json or project.json files
      try {
        const workspacePath = path.join(projectRoot, 'workspace.json');
        const workspaceContent = await fs.readFile(workspacePath, 'utf-8');
        const workspaceJson = JSON.parse(workspaceContent);
        const packages = Object.keys(workspaceJson.projects || {});
        // Nx packages are already resolved paths, not glob patterns
        return { type: 'nx', packages, resolvedPackages: packages };
      } catch {
        return { type: 'nx', packages: [], resolvedPackages: [] };
      }
    } catch {
      // nx.json not found
    }

    return { type: null };
  } catch (error) {
    console.error('Error detecting workspace:', error);
    return { type: null };
  }
}

/**
 * Tracks environment variable usage in file content
 * Detects process.env.VARIABLE_NAME patterns including destructuring
 *
 * @param content - The file content to analyze
 * @returns Object containing array of variable names and total count
 */
export function trackEnvironmentVariables(content: string): { variables: string[]; count: number } {
  const variables = new Set<string>();

  // Remove comments first
  const cleanContent = content
    .replace(/\/\/.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

  // Pattern 1: process.env.VARIABLE_NAME
  const dotNotationRegex = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
  let match: RegExpExecArray | null;
  while ((match = dotNotationRegex.exec(cleanContent)) !== null) {
    variables.add(match[1]);
  }

  // Pattern 2: process.env['VARIABLE_NAME'] or process.env["VARIABLE_NAME"]
  const bracketNotationRegex = /process\.env\[(['"])([A-Z_][A-Z0-9_]*)\1\]/g;
  while ((match = bracketNotationRegex.exec(cleanContent)) !== null) {
    variables.add(match[2]);
  }

  // Pattern 3: Destructuring - const { VAR1, VAR2 } = process.env
  const destructuringRegex = /const\s*\{\s*([^}]+)\s*\}\s*=\s*process\.env/g;
  while ((match = destructuringRegex.exec(cleanContent)) !== null) {
    const varsString = match[1];
    // Split by comma and extract variable names
    const vars = varsString.split(',').map(v => {
      // Handle renaming: VAR1 as var1 -> VAR1
      const parts = v.trim().split(/\s+as\s+/);
      return parts[0].trim();
    }).filter(v => /^[A-Z_][A-Z0-9_]*$/.test(v));

    vars.forEach(v => variables.add(v));
  }

  const variableArray = Array.from(variables);
  return {
    variables: variableArray,
    count: variableArray.length
  };
}

/**
 * Detects middleware patterns across different frameworks
 * Supports Next.js, Express, and NestJS middleware detection
 *
 * @param content - The file content to analyze
 * @param filePath - The file path for context (to detect middleware.ts files)
 * @returns Middleware information including type and array of middleware names
 */
export function detectMiddleware(content: string, filePath: string): { type: 'nextjs' | 'express' | 'nestjs' | null; middlewares: string[] } {
  const middlewares: string[] = [];

  // Remove comments first
  const cleanContent = content
    .replace(/\/\/.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

  // Check for Next.js middleware
  const basename = path.basename(filePath);
  if (basename === 'middleware.ts' || basename === 'middleware.js') {
    // Next.js middleware file
    // Look for exported middleware function or config
    if (/export\s+(?:async\s+)?function\s+middleware/.test(cleanContent)) {
      middlewares.push('middleware');
    }
    if (/export\s+const\s+config/.test(cleanContent)) {
      middlewares.push('config');
    }
    if (middlewares.length > 0) {
      return { type: 'nextjs', middlewares };
    }
  }

  // Check for NestJS middleware decorators
  const nestjsMiddlewarePatterns = [
    { pattern: /@UseGuards\s*\(\s*([^)]+)\s*\)/g, type: 'guard' },
    { pattern: /@UseInterceptors\s*\(\s*([^)]+)\s*\)/g, type: 'interceptor' },
    { pattern: /@UsePipes\s*\(\s*([^)]+)\s*\)/g, type: 'pipe' },
    { pattern: /@UseFilters\s*\(\s*([^)]+)\s*\)/g, type: 'filter' },
  ];

  let hasNestJsMiddleware = false;
  for (const { pattern, type } of nestjsMiddlewarePatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(cleanContent)) !== null) {
      const args = match[1].trim();
      // Extract class names from arguments
      const classNames = args.split(',').map(arg => {
        const trimmed = arg.trim();
        // Handle new ClassName() or just ClassName
        const classMatch = trimmed.match(/(?:new\s+)?(\w+)/);
        return classMatch ? classMatch[1] : trimmed;
      }).filter(name => name && name !== 'new');

      classNames.forEach(name => {
        middlewares.push(`${type}:${name}`);
      });
      hasNestJsMiddleware = true;
    }
  }

  if (hasNestJsMiddleware) {
    return { type: 'nestjs', middlewares };
  }

  // Check for Express middleware
  const expressMiddlewarePatterns = [
    /(?:app|router)\.use\s*\(\s*([^)]+)\s*\)/g,
  ];

  let hasExpressMiddleware = false;
  for (const pattern of expressMiddlewarePatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(cleanContent)) !== null) {
      const args = match[1].trim();
      // Try to extract middleware function names
      // Handle: app.use(express.json()), app.use(cors()), app.use('/path', middleware)
      const middlewareMatch = args.match(/(\w+)(?:\s*\(|\s*,|\s*$)/);
      if (middlewareMatch) {
        const name = middlewareMatch[1];
        // Filter out common non-middleware identifiers
        if (name !== 'function' && name !== 'async' && !name.startsWith('/')) {
          middlewares.push(name);
          hasExpressMiddleware = true;
        }
      }
    }
  }

  if (hasExpressMiddleware) {
    return { type: 'express', middlewares: [...new Set(middlewares)] };
  }

  return { type: null, middlewares: [] };
}

/**
 * Identifies which monorepo package a file belongs to
 * Takes a file path and workspace info, determines which package the file belongs to
 *
 * @param filePath - The file path relative to project root
 * @param workspace - Workspace information with resolved packages
 * @returns The package name/path or null if not in a package
 */
export function identifyPackage(
  filePath: string,
  workspace: WorkspaceInfo | undefined
): string | null {
  if (!workspace || !workspace.resolvedPackages || workspace.resolvedPackages.length === 0) {
    return null;
  }

  // Normalize file path for cross-platform compatibility
  const normalizedFilePath = filePath.replace(/\\/g, '/');

  // Find the package that contains this file
  // Sort packages by length (descending) to match most specific package first
  const sortedPackages = [...workspace.resolvedPackages].sort((a, b) => b.length - a.length);

  for (const pkg of sortedPackages) {
    const normalizedPkg = pkg.replace(/\\/g, '/');

    // Check if file path starts with package path
    if (normalizedFilePath.startsWith(normalizedPkg + '/') || normalizedFilePath.startsWith(normalizedPkg + '\\')) {
      return pkg;
    }
  }

  return null;
}

/**
 * Detects Next.js special file types
 */
function getNextjsType(filePath: string, basename: string): FileInfo['nextjsType'] | undefined {
  // App Router special files
  const appRouterFiles = ['page', 'layout', 'template', 'loading', 'error', 'global-error', 'not-found', 'default'];
  const baseNameWithoutExt = basename.replace(/\.(tsx?|jsx?)$/, '');

  if (appRouterFiles.includes(baseNameWithoutExt)) {
    return baseNameWithoutExt as FileInfo['nextjsType'];
  }

  // Route handlers
  if (baseNameWithoutExt === 'route') {
    return 'route';
  }

  // Middleware
  if (baseNameWithoutExt === 'middleware') {
    return 'middleware';
  }

  // Next.js config
  if (basename.startsWith('next.config.')) {
    return 'config';
  }

  // Pages Router special files
  if (['_app', '_document', '_error', '404', '500'].includes(baseNameWithoutExt)) {
    return 'pages-special';
  }

  // API routes (pages/api directory)
  if (filePath.includes('/pages/api/') || filePath.includes('\\pages\\api\\')) {
    return 'api';
  }

  // App Router metadata files
  const metadataFiles = ['opengraph-image', 'twitter-image', 'icon', 'apple-icon', 'sitemap', 'robots', 'manifest'];
  if (metadataFiles.some(name => baseNameWithoutExt.startsWith(name))) {
    return 'app-special';
  }

  return undefined;
}

/**
 * Determines the file type based on path and extension
 */
function getFileType(filePath: string): 'typescript' | 'javascript' | 'typescript-react' | 'javascript-react' | 'test' | 'types' | 'style' | 'config' | 'asset' {
  const ext = path.extname(filePath);
  const basename = path.basename(filePath);

  // Test files (highest priority - check before other types)
  const testPatterns = [
    /\.test\./i, /\.spec\./i, /__tests__/i, /__test__/i,
    /\.test$/i, /\.spec$/i, /\/tests?\//i, /\/specs?\//i,
    /-test\./i, /-spec\./i, /\.e2e\./i, /\.integration\./i
  ];
  if (testPatterns.some(pattern => pattern.test(filePath))) {
    return 'test';
  }

  // Type definition files
  if (ext === '.d.ts' || basename.endsWith('.d.ts')) {
    return 'types';
  }

  // TypeScript React files (.tsx)
  if (['.tsx'].includes(ext)) {
    return 'typescript-react';
  }

  // TypeScript files (.ts)
  if (['.ts', '.mts', '.cts'].includes(ext)) {
    return 'typescript';
  }

  // JavaScript React files (.jsx)
  if (['.jsx'].includes(ext)) {
    return 'javascript-react';
  }

  // JavaScript files (.js)
  if (['.js', '.mjs', '.cjs'].includes(ext)) {
    return 'javascript';
  }

  // Style files
  if (['.css', '.scss', '.sass', '.less', '.styl', '.pcss'].includes(ext)) {
    return 'style';
  }

  // Asset files (images, fonts, etc.)
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.mp4', '.webm', '.ogg', '.mp3', '.wav',
    '.glsl', '.wasm'].includes(ext)) {
    return 'asset';
  }

  // Config files
  const configPatterns = [
    /config\./i, /\.config\./i, /\.rc$/i, /\.json$/i,
    /package\.json$/i, /tsconfig/i, /webpack/i, /vite/i,
    /\.ya?ml$/i, /\.toml$/i, /\.env/i
  ];
  if (configPatterns.some(pattern => pattern.test(basename))) {
    return 'config';
  }

  // Default to TypeScript (since we're analyzing TS/JS projects)
  return 'typescript';
}

/**
 * Analyzes file and returns both file type and Next.js type
 */
function analyzeFileType(filePath: string): { fileType: FileInfo['fileType']; nextjsType?: FileInfo['nextjsType'] } {
  const basename = path.basename(filePath);
  const fileType = getFileType(filePath);
  const nextjsType = getNextjsType(filePath, basename);

  return { fileType, nextjsType };
}

/**
 * Recursively scans a directory for JavaScript/TypeScript files
 */
async function scanDirectory(
  dirPath: string,
  projectRoot: string,
  files: string[] = [],
  options?: { ignoreBuildDirs?: boolean }
): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    // Skip excluded directories
    if (entry.isDirectory()) {
      // Always skip node_modules and .git
      const alwaysExclude = ['node_modules', '.git'];

      // Build directories to exclude when --ignore-builds is used
      const buildDirs = [
        'dist', 'build', '.next', 'out', '.nuxt', '.output',
        '.vercel', '.netlify', 'coverage', '.cache', '.turbo',
        '.parcel-cache', '.vite', '.rollup.cache', '.webpack'
      ];

      const excludeDirs = options?.ignoreBuildDirs
        ? [...alwaysExclude, ...buildDirs]
        : alwaysExclude;

      if (excludeDirs.includes(entry.name)) {
        continue;
      }
      await scanDirectory(fullPath, projectRoot, files, options);
    } else if (entry.isFile()) {
      // Only include JS/TS files
      const ext = path.extname(entry.name);
      if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Extracts imported identifiers from an import statement
 * Examples:
 * - import express from "express" -> ["express"]
 * - import * as controller from "..." -> ["controller"]
 * - import { a, b } from "..." -> ["a", "b"]
 * - import React, { useState } from "react" -> ["React", "useState"]
 * - import { a as b, c } from "..." -> ["b", "c"]
 * - import type { A, B } from "..." -> ["A", "B"]
 */
function extractImportedIdentifiers(importStatement: string): string[] {
  const identifiers: string[] = [];

  // Normalize line endings and collapse whitespace
  const normalized = importStatement.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

  // Remove the 'from' part and everything after it
  const beforeFrom = normalized.split(/\s+from\s+/i)[0];
  if (!beforeFrom) return identifiers;

  // Remove 'import' keyword and optional 'type' keyword
  let importPart = beforeFrom.replace(/^\s*import\s+(?:type\s+)?/i, '').trim();

  // Handle namespace imports: import * as name
  const namespaceMatch = importPart.match(/^\*\s+as\s+(\w+)$/);
  if (namespaceMatch) {
    identifiers.push(namespaceMatch[1]);
    return identifiers;
  }

  // Separate default import from destructured imports
  // Pattern: "defaultName, { a, b }" or just "defaultName" or just "{ a, b }"
  let defaultImport: string | null = null;
  let destructuredPart: string | null = null;

  const destructuredMatch = importPart.match(/\{([^}]+)\}/);
  if (destructuredMatch) {
    destructuredPart = destructuredMatch[1];
    // Everything before the { is the default import
    const beforeBrace = importPart.substring(0, destructuredMatch.index).trim();
    if (beforeBrace && beforeBrace !== ',') {
      defaultImport = beforeBrace.replace(/,\s*$/, '').trim();
    }
  } else {
    // No braces, so it's a default import
    defaultImport = importPart.trim();
  }

  // Add default import if it exists
  if (defaultImport) {
    const defaultId = defaultImport.match(/^(\w+)/);
    if (defaultId) {
      identifiers.push(defaultId[1]);
    }
  }

  // Handle destructured imports: { a, b as c, d }
  if (destructuredPart) {
    const items = destructuredPart.split(',').map(i => i.trim()).filter(i => i.length > 0);
    for (const item of items) {
      // Remove 'type' keyword if present (for TypeScript type-only imports)
      const cleanItem = item.replace(/^type\s+/, '');

      // Handle 'as' renaming: "a as b" -> use "b"
      const asMatch = cleanItem.match(/^(\w+)\s+as\s+(\w+)$/);
      if (asMatch) {
        identifiers.push(asMatch[2]);
      } else {
        // Simple identifier
        const identifier = cleanItem.match(/^(\w+)$/);
        if (identifier) {
          identifiers.push(identifier[1]);
        }
      }
    }
  }

  return identifiers;
}

/**
 * Extracts import statements from file content with their identifiers
 */
export function extractImports(content: string): Array<{ path: string; identifiers: string[] }> {
  const imports: Array<{ path: string; identifiers: string[] }> = [];
  const seenPaths = new Set<string>();

  // Remove comments first to avoid false matches
  let cleanContent = content
    .replace(/\/\/.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

  // Pattern 1: import ... from "path" (handles multi-line imports)
  // Match everything between 'import' and 'from', then capture the path
  const importFromRegex = /import\s+([\s\S]*?)\s+from\s+(['"])([^'"]+)\2/g;
  let match: RegExpExecArray | null;
  while ((match = importFromRegex.exec(cleanContent)) !== null) {
    const importPath = match[3];
    const importStatement = match[0];
    if (!seenPaths.has(importPath)) {
      seenPaths.add(importPath);
      imports.push({
        path: importPath,
        identifiers: extractImportedIdentifiers(importStatement)
      });
    }
  }

  // Pattern 2: Side-effect imports - import "path"
  const sideEffectRegex = /import\s+(['"])([^'"]+)\1/g;
  while ((match = sideEffectRegex.exec(cleanContent)) !== null) {
    const importPath = match[2];
    if (!seenPaths.has(importPath)) {
      seenPaths.add(importPath);
      imports.push({
        path: importPath,
        identifiers: []
      });
    }
  }

  // Pattern 3: Dynamic imports - import("path")
  const dynamicRegex = /import\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
  while ((match = dynamicRegex.exec(cleanContent)) !== null) {
    const importPath = match[2];
    if (!seenPaths.has(importPath)) {
      seenPaths.add(importPath);
      imports.push({
        path: importPath,
        identifiers: []
      });
    }
  }

  // Pattern 4: Re-exports - export ... from "path"
  const reExportRegex = /export\s+([\s\S]*?)\s+from\s+(['"])([^'"]+)\2/g;
  while ((match = reExportRegex.exec(cleanContent)) !== null) {
    const importPath = match[3];
    const exportStatement = match[0];
    if (!seenPaths.has(importPath)) {
      seenPaths.add(importPath);
      const identifiers = exportStatement.includes('{')
        ? extractImportedIdentifiers(exportStatement.replace(/^export/, 'import'))
        : [];
      imports.push({
        path: importPath,
        identifiers
      });
    }
  }

  return imports;
}

/**
 * Counts how many times each identifier is used in the content
 * Excludes usage in comments and strings
 */
function countIdentifierUsage(content: string, identifiers: string[]): Map<string, number> {
  const usageCount = new Map<string, number>();

  // Remove comments and strings to avoid false positives
  let cleanContent = content
    // Remove single-line comments
    .replace(/\/\/.*$/gm, '')
    // Remove multi-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Remove template literals
    .replace(/`(?:\\.|[^`\\])*`/g, '')
    // Remove strings
    .replace(/"(?:\\.|[^"\\])*"/g, '')
    .replace(/'(?:\\.|[^'\\])*'/g, '');

  for (const identifier of identifiers) {
    // Match identifier as a whole word (not part of another identifier)
    const regex = new RegExp(`\\b${identifier}\\b`, 'g');
    const matches = cleanContent.match(regex);
    const count = matches ? matches.length : 0;

    // Subtract 1 to exclude the import statement itself
    usageCount.set(identifier, Math.max(0, count - 1));
  }

  return usageCount;
}

/**
 * Reads and parses tsconfig.json or jsconfig.json
 */
async function readTsConfig(projectRoot: string): Promise<TsConfig | null> {
  const configFiles = ['tsconfig.json', 'jsconfig.json'];

  for (const configFile of configFiles) {
    const configPath = path.join(projectRoot, configFile);
    try {
      console.log(`Looking for config file: ${configPath}`);
      const content = await fs.readFile(configPath, 'utf-8');
      console.log(`✓ Found ${configFile} (${content.length} bytes)`);

      console.log(`Attempting to parse JSON...`);
      const parsed = JSON.parse(content) as TsConfig;
      console.log(`✓ Successfully parsed ${configFile}`);

      if (parsed.compilerOptions?.paths) {
        console.log(`✓ Found path mappings in ${configFile}:`, Object.keys(parsed.compilerOptions.paths));
      } else {
        console.log(`  No path mappings found in ${configFile}`);
      }

      return parsed;
    } catch (error) {
      if (error instanceof Error) {
        console.log(`  Error reading ${configFile}: ${error.message}`);
      } else {
        console.log(`  ${configFile} not found or invalid`);
      }
      continue;
    }
  }

  console.log('No valid tsconfig.json or jsconfig.json found');
  return null;
}

/**
 * Parses path mappings from tsconfig
 */
function parsePathMappings(tsConfig: TsConfig | null, projectRoot: string): PathMapping[] {
  if (!tsConfig?.compilerOptions?.paths) {
    return [];
  }

  const baseUrl = tsConfig.compilerOptions.baseUrl || '.';
  const baseUrlResolved = path.resolve(projectRoot, baseUrl);
  console.log(`Base URL: ${baseUrl} (resolved to: ${baseUrlResolved})`);

  const mappings: PathMapping[] = [];

  for (const [alias, targets] of Object.entries(tsConfig.compilerOptions.paths)) {
    // Store the prefix with wildcard info
    const prefix = alias;

    // Resolve target paths relative to baseUrl
    const resolvedPaths = targets.map(target => {
      const targetPath = target;
      const resolved = path.resolve(baseUrlResolved, targetPath.replace(/\/\*$/, ''));
      console.log(`  ${alias} → ${target} (resolved to: ${resolved})`);
      return resolved;
    });

    mappings.push({ prefix, paths: resolvedPaths });
  }

  console.log(`Configured ${mappings.length} path mapping(s)`);
  return mappings;
}

/**
 * Resolves an import path using path mappings to absolute path
 */
function resolveWithPathMappings(
  importPath: string,
  pathMappings: PathMapping[],
  projectRoot: string,
  scannedFiles: Set<string>
): string | null {
  for (const mapping of pathMappings) {
    let matches = false;
    let suffix = '';

    if (mapping.prefix.endsWith('/*')) {
      // Wildcard pattern like "@/*"
      const prefixWithoutWildcard = mapping.prefix.slice(0, -2); // "@/*" -> "@"
      if (importPath.startsWith(prefixWithoutWildcard + '/')) {
        matches = true;
        suffix = importPath.slice(prefixWithoutWildcard.length + 1); // Skip the "@/" part
      }
    } else {
      // Exact match like "@wardatrobe/schemas"
      if (importPath === mapping.prefix) {
        matches = true;
        suffix = '';
      }
    }

    if (matches) {
      for (const targetPath of mapping.paths) {
        // Build absolute path
        const absolutePath = path.join(targetPath, suffix);

        // Try with different extensions
        const extensions = ['.ts', '.tsx', '.js', '.jsx'];
        for (const ext of extensions) {
          const pathWithExt = absolutePath + ext;
          // Check if this file actually exists in our scanned files
          if (scannedFiles.has(pathWithExt)) {
            const relativePath = path.relative(projectRoot, pathWithExt);
            return relativePath;
          }
        }

        // Try index files
        for (const ext of extensions) {
          const indexPath = path.join(absolutePath, `index${ext}`);
          if (scannedFiles.has(indexPath)) {
            const relativePath = path.relative(projectRoot, indexPath);
            return relativePath;
          }
        }

        // If no extension, return as-is
        if (!path.extname(absolutePath)) {
          return path.relative(projectRoot, absolutePath);
        }
      }
    }
  }

  return null;
}

/**
 * Resolves any import path to a relative path from project root
 * Strategy: Convert everything to absolute paths first, then back to relative
 */
function resolveImportPath(
  importPath: string,
  currentFilePath: string,
  projectRoot: string,
  pathMappings: PathMapping[],
  scannedFiles: Set<string>
): string | null {
  let absolutePath: string;

  // Step 1: Resolve to absolute path
  if (importPath.startsWith('.')) {
    // Relative import: resolve relative to current file
    const currentDir = path.dirname(currentFilePath);
    absolutePath = path.resolve(currentDir, importPath);
  } else {
    // Non-relative import: try path mappings first
    const resolved = resolveWithPathMappings(importPath, pathMappings, projectRoot, scannedFiles);
    if (resolved) {
      // resolveWithPathMappings already returns relative path, convert back to absolute
      absolutePath = path.resolve(projectRoot, resolved);
    } else {
      // External package
      return null;
    }
  }

  // Step 2: Try to find the actual file with various extensions
  const ext = path.extname(absolutePath);

  if (!ext) {
    // No extension - try adding common extensions and check if file exists
    const extensions = ['.tsx', '.ts', '.jsx', '.js'];
    for (const extension of extensions) {
      const pathWithExt = absolutePath + extension;
      const relativePath = path.relative(projectRoot, pathWithExt);
      // Check if this file actually exists in our scanned files
      if (scannedFiles.has(pathWithExt)) {
        return relativePath;
      }
    }

    // Try index files
    for (const extension of extensions) {
      const indexPath = path.join(absolutePath, `index${extension}`);
      if (scannedFiles.has(indexPath)) {
        return path.relative(projectRoot, indexPath);
      }
    }
  } else {
    // Has extension - handle .js/.jsx that might actually be .ts/.tsx
    if (ext === '.js' || ext === '.jsx') {
      const tsExt = ext === '.js' ? '.ts' : '.tsx';
      const tsPath = absolutePath.slice(0, -ext.length) + tsExt;
      return path.relative(projectRoot, tsPath);
    }
  }

  // Return as-is
  return path.relative(projectRoot, absolutePath);
}

/**
 * Analyzes a project directory and extracts file information
 */
export async function analyzeProject(
  projectPath: string,
  options?: { ignoreBuildDirs?: boolean }
): Promise<FileInfo[]> {
  const projectRoot = path.resolve(projectPath);

  // Read tsconfig/jsconfig for path mappings
  console.log('\n=== Path Alias Configuration ===');
  const tsConfig = await readTsConfig(projectRoot);
  const pathMappings = parsePathMappings(tsConfig, projectRoot);
  console.log('================================\n');

  console.log('\n=== Workspace Detection ===');
  const workspaceInfo = await detectWorkspace(projectRoot);
  if (workspaceInfo.type) {
    console.log(`✓ Detected ${workspaceInfo.type} workspace`);
    if (workspaceInfo.packages) {
      console.log(`  Packages (patterns): ${workspaceInfo.packages.join(', ')}`);
    }
    if (workspaceInfo.resolvedPackages && workspaceInfo.resolvedPackages.length > 0) {
      console.log(`  Resolved packages (${workspaceInfo.resolvedPackages.length}): ${workspaceInfo.resolvedPackages.join(', ')}`);
    }
  } else {
    console.log('  No monorepo workspace detected');
  }
  console.log('===========================\n');

  const files = await scanDirectory(projectRoot, projectRoot, [], options);
  const fileInfos: FileInfo[] = [];

  // Create a Set of scanned files for fast lookup
  const scannedFilesSet = new Set(files);

  const fileImporters = new Map<string, Set<string>>();

  // First pass: collect all file info
  for (const filePath of files) {
    const stats = await fs.stat(filePath);
    const content = await fs.readFile(filePath, 'utf-8');
    const rawImports = extractImports(content);

    // Count lines in the file
    const lines = content.split('\n').length;

    // Resolve imports to absolute paths relative to project root
    const resolvedImports: string[] = [];
    const externalImports: string[] = [];
    const importUsage = new Map<string, number>(); // File path -> total usage count

    for (const importInfo of rawImports) {
      const resolved = resolveImportPath(importInfo.path, filePath, projectRoot, pathMappings, scannedFilesSet);
      if (resolved !== null) {
        resolvedImports.push(resolved);
        // Count usage of imported identifiers
        if (importInfo.identifiers.length > 0) {
          const identifierUsage = countIdentifierUsage(content, importInfo.identifiers);
          let totalUsage = 0;
          for (const count of identifierUsage.values()) {
            totalUsage += count;
          }
          importUsage.set(resolved, (importUsage.get(resolved) || 0) + totalUsage);
        }
      } else if (!importInfo.path.startsWith('.')) {
        // This is an external package import
        externalImports.push(importInfo.path);
      }
    }

    // Count import occurrences (how many times each file is imported)
    const importCount = new Map<string, number>();
    for (const importPath of resolvedImports) {
      importCount.set(importPath, (importCount.get(importPath) || 0) + 1);
    }

    const { fileType, nextjsType } = analyzeFileType(filePath);

    // Run existing detection functions
    const componentType = detectReactComponentType(content);
    const serverActions = detectServerActions(content);
    const nodeFramework = detectNodeFramework(content);
    const moduleSystem = detectModuleSystem(content);

    //Run Next.js routing detection functions on file path
    const relativePath = path.relative(projectRoot, filePath);
    const routeGroup = detectRouteGroup(relativePath);
    const dynamicSegments = detectDynamicSegments(relativePath);
    const parallelRoute = detectParallelRoute(relativePath);
    const interceptingRoute = detectInterceptingRoute(relativePath);

    // Detect HTTP methods for API routes and route handlers
    let httpMethods: string[] | undefined;
    if (nextjsType === 'route' || nextjsType === 'api') {
      httpMethods = detectHTTPMethods(content);
      if (httpMethods.length === 0) {
        httpMethods = undefined;
      }
    }

    // Track dynamic imports
    const dynamicImportsData = trackDynamicImports(content);
    const dynamicImports = dynamicImportsData.count > 0 ? dynamicImportsData : undefined;

    // Track environment variables
    const envVarsData = trackEnvironmentVariables(content);
    const environmentVariables = envVarsData.count > 0 ? envVarsData : undefined;

    // Detect middleware
    const middlewareData = detectMiddleware(content, filePath);
    const middleware = middlewareData.type ? middlewareData : undefined;

    // Track importers for shared library detection
    for (const importedFile of resolvedImports) {
      if (!fileImporters.has(importedFile)) {
        fileImporters.set(importedFile, new Set());
      }
      fileImporters.get(importedFile)!.add(relativePath);
    }

    // Identify which package this file belongs to
    const packageName = identifyPackage(relativePath, workspaceInfo.type ? workspaceInfo : undefined);

    const fileInfo: FileInfo = {
      path: relativePath,
      size: stats.size,
      lines,
      imports: [...new Set(resolvedImports)], // Remove duplicates
      importCount,
      externalImports: [...new Set(externalImports)], // Remove duplicates
      importUsage,
      fileType,
      nextjsType,
      // Add existing optional fields only if they have values
      ...(componentType && { componentType }),
      ...(serverActions.length > 0 && { serverActions }),
      ...(nodeFramework && { nodeFramework }),
      ...(moduleSystem && { moduleSystem }),
      // Add Next.js routing fields only if they have values
      ...(routeGroup && { routeGroup }),
      ...(dynamicSegments.length > 0 && { dynamicSegments }),
      ...(parallelRoute && { parallelRoute }),
      ...(interceptingRoute && { interceptingRoute }),
      ...(httpMethods && { httpMethods }),
      ...(dynamicImports && { dynamicImports }),
      // Add monorepo and configuration detection fields
      ...(workspaceInfo.type && {
        workspace: {
          type: workspaceInfo.type,
          packages: workspaceInfo.packages,
          resolvedPackages: workspaceInfo.resolvedPackages
        }
      }),
      ...(packageName && { package: packageName }),
      ...(environmentVariables && { environmentVariables }),
      ...(middleware && middleware.type && { middleware: { type: middleware.type, middlewares: middleware.middlewares } }),
    };

    fileInfos.push(fileInfo);
  }

  // Second pass - detect shared libraries
  // A file is considered shared if it's imported by 2 or more other files
  for (const fileInfo of fileInfos) {
    const importers = fileImporters.get(fileInfo.path);
    if (importers && importers.size >= 2) {
      fileInfo.isSharedLibrary = true;
      fileInfo.importedByPackages = Array.from(importers);
    }
  }

  return fileInfos;
}