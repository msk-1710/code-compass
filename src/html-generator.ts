import { GraphData, ColorScheme } from './graph-builder.js';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generates a standalone HTML file with embedded React visualization
 */
export async function generateHTML(
  graphData: GraphData,
  projectName: string,
  initialColorScheme: ColorScheme = 'default'
): Promise<string> {
  // Convert Map to array for JSON serialization
  const graphDataForJSON = {
    ...graphData,
    externalDependencies: Array.from(graphData.externalDependencies.entries())
  };

  // Run Vite build first
  console.log('Building React visualization...');
  const projectRoot = path.resolve(__dirname, '..');
  
  await execAsync('npm run build:viz', {
    cwd: projectRoot,
    env: { ...process.env }
  });

  // Read the built HTML file
  const builtHtmlPath = path.join(projectRoot, 'dist', 'visualization', 'index.html');
  let builtHtml = await fs.readFile(builtHtmlPath, 'utf-8');

  // Inject data script into the built HTML (before closing </head> tag)
  const dataScript = `
    <script>
      // Embedded graph data
      window.__GRAPH_DATA__ = ${JSON.stringify(graphDataForJSON)};
      // Convert externalDependencies array back to Map
      window.__GRAPH_DATA__.externalDependencies = new Map(window.__GRAPH_DATA__.externalDependencies);
      
      window.__PROJECT_NAME__ = ${JSON.stringify(projectName)};
      window.__COLOR_SCHEME__ = ${JSON.stringify(initialColorScheme)};
    </script>
  `;

  // Inject the data script before the closing </head> tag
  builtHtml = builtHtml.replace('</head>', `${dataScript}\n  </head>`);

  return builtHtml;
}

/**
 * Escapes HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}