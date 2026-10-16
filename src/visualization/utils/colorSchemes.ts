import { ColorScheme, FileType, NextjsType, GraphNode } from '../types/graph';

export const COLOR_SCHEMES = {
  default: {
    typescript: '#3178c6',
    javascript: '#f7df1e',
    'typescript-react': '#61dafb',
    'javascript-react': '#61dafb',
    test: '#9b59b6',
    types: '#95a5a6',
    style: '#e91e63',
    config: '#ff9800',
    asset: '#607d8b',
    external: '#34495e'
  },
  nextjs: {
    page: '#0070f3',
    layout: '#7928ca',
    template: '#ff0080',
    loading: '#f5a623',
    error: '#e74c3c',
    'not-found': '#e67e22',
    route: '#2ecc71',
    middleware: '#9b59b6',
    config: '#ff9800',
    api: '#3498db',
    'app-special': '#1abc9c',
    'pages-special': '#16a085'
  },
  metadata: {
    'client-component': '#60a5fa',
    'server-component': '#2563eb',
    'server-action': '#f97316',
    express: '#22c55e',
    nestjs: '#ef4444',
    fastify: '#6b7280'
  },
  framework: {
    express: '#22c55e',
    nestjs: '#ef4444',
    fastify: '#6b7280',
    'client-component': '#60a5fa',
    'server-component': '#2563eb',
    'no-framework': '#94a3b8',
    test: '#9b59b6',
    config: '#ff9800',
    external: '#34495e'
  },
  architecture: {
    component: '#61dafb',
    page: '#0ea5e9',
    style: '#e91e63',
    api: '#10b981',
    'route-handler': '#059669',
    middleware: '#8b5cf6',
    'server-action': '#f97316',
    utility: '#fbbf24',
    types: '#94a3b8',
    config: '#f59e0b',
    test: '#a855f7',
    external: '#475569'
  },
  moduleSystem: {
    esm: '#10b981',
    commonjs: '#f59e0b',
    mixed: '#ef4444',
    'has-dynamic-imports': '#8b5cf6',
    'no-imports': '#94a3b8',
    test: '#a855f7',
    external: '#475569'
  },
  monorepo: {
    // Dynamic colors will be generated based on packages
    'shared-library': '#fbbf24',
    'root-config': '#94a3b8',
    external: '#475569'
  },
  testCoverage: {
    'test-file': '#a855f7',
    'fully-tested': '#10b981',        // Green - has dedicated test file
    'partially-tested': '#fbbf24',    // Yellow/Amber - imported by tests
    'untested-code': '#ef4444',       // Red - no test coverage
    'test-utility': '#8b5cf6',
    mock: '#c084fc',
    config: '#f59e0b',
    external: '#475569'
  }
} as const;

// Generate distinct colors for monorepo packages
const PACKAGE_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Orange
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316', // Orange-red
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#a855f7', // Purple-light
  '#0ea5e9', // Sky
  '#22c55e', // Green-light
];

function getPackageColor(packageName: string, allPackages: string[]): string {
  const index = allPackages.indexOf(packageName);
  return PACKAGE_COLORS[index % PACKAGE_COLORS.length];
}

export function getNodeColor(
  node: GraphNode,
  colorScheme: ColorScheme,
  allNodes?: GraphNode[]
): string {
  const { fileType, nextjsType, nodeFramework, componentType, moduleSystem, package: pkg, isTest, isExternal, httpMethods, dynamicImports } = node;

  // Handle external nodes consistently across all schemes
  if (isExternal) {
    return COLOR_SCHEMES.default.external;
  }

  switch (colorScheme) {
    case 'nextjs':
      if (nextjsType) {
        return COLOR_SCHEMES.nextjs[nextjsType] || COLOR_SCHEMES.default[fileType];
      }
      return COLOR_SCHEMES.default[fileType] || '#cccccc';

    case 'framework':
      // Color by backend framework or React component type
      if (nodeFramework) {
        return COLOR_SCHEMES.framework[nodeFramework];
      }
      if (componentType === 'client') {
        return COLOR_SCHEMES.framework['client-component'];
      }
      if (componentType === 'server') {
        return COLOR_SCHEMES.framework['server-component'];
      }
      if (isTest) {
        return COLOR_SCHEMES.framework.test;
      }
      if (fileType === 'config') {
        return COLOR_SCHEMES.framework.config;
      }
      return COLOR_SCHEMES.framework['no-framework'];

    case 'architecture':
      // Color by architectural layer
      if (isTest) {
        return COLOR_SCHEMES.architecture.test;
      }
      if (httpMethods && httpMethods.length > 0) {
        return COLOR_SCHEMES.architecture.api;
      }
      if (nextjsType === 'route' || nextjsType === 'api') {
        return COLOR_SCHEMES.architecture['route-handler'];
      }
      if (nextjsType === 'middleware' || nodeFramework) {
        return COLOR_SCHEMES.architecture.middleware;
      }
      if (node.serverActions && node.serverActions.length > 0) {
        return COLOR_SCHEMES.architecture['server-action'];
      }
      if (fileType === 'typescript-react' || fileType === 'javascript-react') {
        return COLOR_SCHEMES.architecture.component;
      }
      if (nextjsType === 'page' || nextjsType === 'layout') {
        return COLOR_SCHEMES.architecture.page;
      }
      if (fileType === 'style') {
        return COLOR_SCHEMES.architecture.style;
      }
      if (fileType === 'types') {
        return COLOR_SCHEMES.architecture.types;
      }
      if (fileType === 'config') {
        return COLOR_SCHEMES.architecture.config;
      }
      // Check if it's a utility file (common patterns)
      if (node.label.includes('util') || node.label.includes('helper') || node.label.includes('lib')) {
        return COLOR_SCHEMES.architecture.utility;
      }
      return COLOR_SCHEMES.architecture.utility;

    case 'module-system':
      // Color by module system
      if (isTest) {
        return COLOR_SCHEMES.moduleSystem.test;
      }
      if (dynamicImports && dynamicImports.count > 0) {
        return COLOR_SCHEMES.moduleSystem['has-dynamic-imports'];
      }
      if (moduleSystem === 'esm') {
        return COLOR_SCHEMES.moduleSystem.esm;
      }
      if (moduleSystem === 'commonjs') {
        return COLOR_SCHEMES.moduleSystem.commonjs;
      }
      if (moduleSystem === 'mixed') {
        return COLOR_SCHEMES.moduleSystem.mixed;
      }
      if (node.imports === 0 && node.importedBy === 0) {
        return COLOR_SCHEMES.moduleSystem['no-imports'];
      }
      return COLOR_SCHEMES.moduleSystem.esm;

    case 'monorepo':
      // Color by package
      if (pkg && allNodes) {
        const allPackages = Array.from(new Set(allNodes.map(n => n.package).filter(Boolean))) as string[];
        return getPackageColor(pkg, allPackages);
      }
      // Check if it's a shared library (imported by multiple packages)
      if (allNodes && node.importedBy >= 2) {
        const importers = allNodes.filter(n =>
          n.externalDependencies?.includes(node.id) ||
          (n.package && n.package !== pkg)
        );
        if (importers.length >= 2) {
          return COLOR_SCHEMES.monorepo['shared-library'];
        }
      }
      if (fileType === 'config') {
        return COLOR_SCHEMES.monorepo['root-config'];
      }
      return COLOR_SCHEMES.monorepo['root-config'];

    case 'test-coverage':
      // Color by test coverage
      if (isTest) {
        // Check if it's a test utility or mock
        if (node.label.includes('mock') || node.label.includes('Mock')) {
          return COLOR_SCHEMES.testCoverage.mock;
        }
        if (node.label.includes('util') || node.label.includes('helper') || node.label.includes('setup')) {
          return COLOR_SCHEMES.testCoverage['test-utility'];
        }
        return COLOR_SCHEMES.testCoverage['test-file'];
      }
      if (fileType === 'config') {
        return COLOR_SCHEMES.testCoverage.config;
      }
      
      // Check test coverage with three-tier system
      if (allNodes) {
        const testFiles = allNodes.filter(n => n.isTest);
        
        // Check if there's a dedicated test file (naming pattern match)
        const hasDedicatedTestFile = testFiles.some(testFile => {
          const testFileName = testFile.label.toLowerCase();
          const sourceFileName = node.label.toLowerCase();
          
          // Remove common test suffixes/prefixes
          const testBase = testFileName
            .replace(/\.test\.(ts|tsx|js|jsx)$/, '')
            .replace(/\.spec\.(ts|tsx|js|jsx)$/, '')
            .replace(/^__tests__\//, '');
          
          const sourceBase = sourceFileName
            .replace(/\.(ts|tsx|js|jsx)$/, '');
          
          return testBase === sourceBase;
        });
        
        if (hasDedicatedTestFile) {
          return COLOR_SCHEMES.testCoverage['fully-tested'];
        }
        
        // Check if file is imported by any test files (use graph edges)
        const isImportedByTests = testFiles.some(testFile => {
          // Check if this test file imports the source file
          // We need to look at the edges where testFile is the source and node is the target
          return allNodes.some(n =>
            n.id === testFile.id &&
            n.externalDependencies?.some(dep => dep.includes(node.label))
          );
        });
        
        if (isImportedByTests) {
          return COLOR_SCHEMES.testCoverage['partially-tested'];
        }
      }
      return COLOR_SCHEMES.testCoverage['untested-code'];

    default:
      // Default color scheme
      return COLOR_SCHEMES.default[fileType] || '#cccccc';
  }
}

export function getFileTypeLabel(fileType: FileType): string {
  const labels: Record<FileType, string> = {
    typescript: 'TypeScript',
    javascript: 'JavaScript',
    'typescript-react': 'TypeScript React',
    'javascript-react': 'JavaScript React',
    test: 'Test File',
    types: 'Type Definitions',
    style: 'Stylesheet',
    config: 'Configuration',
    asset: 'Asset',
    external: 'External Dependency'
  };
  return labels[fileType] || fileType;
}

export function getNextjsTypeLabel(nextjsType: NextjsType): string {
  const labels: Record<NextjsType, string> = {
    page: 'Page',
    layout: 'Layout',
    template: 'Template',
    loading: 'Loading',
    error: 'Error',
    'not-found': 'Not Found',
    route: 'Route Handler',
    middleware: 'Middleware',
    config: 'Config',
    api: 'API Route',
    'app-special': 'App Special File',
    'pages-special': 'Pages Special File'
  };
  return labels[nextjsType] || nextjsType;
}

export function getLegendItems(colorScheme: ColorScheme, allNodes?: GraphNode[]) {
  switch (colorScheme) {
    case 'nextjs': {
      const nextjsItems = Object.entries(COLOR_SCHEMES.nextjs).map(([type, color]) => ({
        label: getNextjsTypeLabel(type as NextjsType),
        color
      }));
      
      // Add metadata colors for Next.js scheme
      const metadataItems = [
        { label: 'Client Component', color: COLOR_SCHEMES.metadata['client-component'] },
        { label: 'Server Component', color: COLOR_SCHEMES.metadata['server-component'] },
        { label: 'Server Action', color: COLOR_SCHEMES.metadata['server-action'] },
        { label: 'Express', color: COLOR_SCHEMES.metadata.express },
        { label: 'NestJS', color: COLOR_SCHEMES.metadata.nestjs },
        { label: 'Fastify', color: COLOR_SCHEMES.metadata.fastify }
      ];
      
      return [...nextjsItems, ...metadataItems];
    }

    case 'framework':
      return [
        { label: 'Express', color: COLOR_SCHEMES.framework.express },
        { label: 'NestJS', color: COLOR_SCHEMES.framework.nestjs },
        { label: 'Fastify', color: COLOR_SCHEMES.framework.fastify },
        { label: 'Client Component', color: COLOR_SCHEMES.framework['client-component'] },
        { label: 'Server Component', color: COLOR_SCHEMES.framework['server-component'] },
        { label: 'No Framework', color: COLOR_SCHEMES.framework['no-framework'] },
        { label: 'Test', color: COLOR_SCHEMES.framework.test },
        { label: 'Config', color: COLOR_SCHEMES.framework.config },
        { label: 'External', color: COLOR_SCHEMES.framework.external }
      ];

    case 'architecture':
      return [
        { label: 'Component', color: COLOR_SCHEMES.architecture.component },
        { label: 'Page', color: COLOR_SCHEMES.architecture.page },
        { label: 'API Route', color: COLOR_SCHEMES.architecture.api },
        { label: 'Route Handler', color: COLOR_SCHEMES.architecture['route-handler'] },
        { label: 'Middleware', color: COLOR_SCHEMES.architecture.middleware },
        { label: 'Server Action', color: COLOR_SCHEMES.architecture['server-action'] },
        { label: 'Utility', color: COLOR_SCHEMES.architecture.utility },
        { label: 'Types', color: COLOR_SCHEMES.architecture.types },
        { label: 'Style', color: COLOR_SCHEMES.architecture.style },
        { label: 'Config', color: COLOR_SCHEMES.architecture.config },
        { label: 'Test', color: COLOR_SCHEMES.architecture.test },
        { label: 'External', color: COLOR_SCHEMES.architecture.external }
      ];

    case 'module-system':
      return [
        { label: 'ES Modules', color: COLOR_SCHEMES.moduleSystem.esm },
        { label: 'CommonJS', color: COLOR_SCHEMES.moduleSystem.commonjs },
        { label: 'Mixed', color: COLOR_SCHEMES.moduleSystem.mixed },
        { label: 'Has Dynamic Imports', color: COLOR_SCHEMES.moduleSystem['has-dynamic-imports'] },
        { label: 'No Imports', color: COLOR_SCHEMES.moduleSystem['no-imports'] },
        { label: 'Test', color: COLOR_SCHEMES.moduleSystem.test },
        { label: 'External', color: COLOR_SCHEMES.moduleSystem.external }
      ];

    case 'monorepo': {
      const items: Array<{ label: string; color: string }> = [];
      
      // Add package-specific colors if nodes are provided
      if (allNodes) {
        const packages = Array.from(new Set(allNodes.map(n => n.package).filter(Boolean))) as string[];
        packages.forEach(pkg => {
          items.push({
            label: `Package: ${pkg}`,
            color: getPackageColor(pkg, packages)
          });
        });
      }
      
      // Add common items
      items.push(
        { label: 'Shared Library', color: COLOR_SCHEMES.monorepo['shared-library'] },
        { label: 'Root Config', color: COLOR_SCHEMES.monorepo['root-config'] },
        { label: 'External', color: COLOR_SCHEMES.monorepo.external }
      );
      
      return items;
    }

    case 'test-coverage':
      return [
        { label: 'Test File', color: COLOR_SCHEMES.testCoverage['test-file'] },
        { label: 'Fully Tested (has test file)', color: COLOR_SCHEMES.testCoverage['fully-tested'] },
        { label: 'Partially Tested (imported by tests)', color: COLOR_SCHEMES.testCoverage['partially-tested'] },
        { label: 'Untested Code', color: COLOR_SCHEMES.testCoverage['untested-code'] },
        { label: 'Test Utility', color: COLOR_SCHEMES.testCoverage['test-utility'] },
        { label: 'Mock', color: COLOR_SCHEMES.testCoverage.mock },
        { label: 'Config', color: COLOR_SCHEMES.testCoverage.config },
        { label: 'External', color: COLOR_SCHEMES.testCoverage.external }
      ];

    default:
      return Object.entries(COLOR_SCHEMES.default).map(([type, color]) => ({
        label: getFileTypeLabel(type as FileType),
        color
      }));
  }
}