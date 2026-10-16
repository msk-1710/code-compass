import React from 'react';
import { Panel } from '../UI/Panel';
import { GraphNode } from '../../types/graph';
import { formatFileSize, formatNumber } from '../../utils/formatters';
import { getFileTypeLabel, getNextjsTypeLabel } from '../../utils/colorSchemes';
import styles from './FileDetailsPanel.module.css';

export interface FileDetailsPanelProps {
  visible: boolean;
  onClose: () => void;
  node: GraphNode | null;
}

export const FileDetailsPanel: React.FC<FileDetailsPanelProps> = ({
  visible,
  onClose,
  node
}) => {
  if (!node) {
    return (
      <Panel
        visible={visible}
        onClose={onClose}
        title="File Details"
        className={styles.fileDetailsPanel}
      >
        <div className={styles.noSelection}>
          <p>No file selected</p>
          <p className={styles.hint}>Click on a node to view details</p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      visible={visible}
      onClose={onClose}
      title="File Details"
      className={styles.fileDetailsPanel}
    >
      <div className={styles.details}>
        <div className={styles.header}>
          <h3 className={styles.fileName}>{node.label}</h3>
          <div
            className={styles.colorIndicator}
            style={{ backgroundColor: node.color }}
          />
        </div>

        {node.package && (
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Package</h4>
            <div className={styles.info}>
              <span className={styles.value} style={{
                fontWeight: 'bold',
                color: '#2563eb',
                padding: '4px 8px',
                backgroundColor: '#eff6ff',
                borderRadius: '4px',
                display: 'inline-block'
              }}>
                📦 {node.package}
              </span>
            </div>
            {node.workspace && (
              <div className={styles.info} style={{ marginTop: '4px', fontSize: '0.85em', color: '#666' }}>
                <span className={styles.label}>Workspace:</span>
                <span className={styles.value}>{node.workspace.type}</span>
              </div>
            )}
          </div>
        )}

        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Path</h4>
          <div className={styles.info}>
            <span className={styles.value} style={{ wordBreak: 'break-all', fontSize: '0.9em' }}>
              {node.id}
            </span>
          </div>
        </div>

        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Type</h4>
          <div className={styles.info}>
            <span className={styles.label}>File Type:</span>
            <span className={styles.value}>{node.fileType ? getFileTypeLabel(node.fileType) : 'Unknown'}</span>
          </div>
          {node.nextjsType && (
            <div className={styles.info}>
              <span className={styles.label}>Next.js Type:</span>
              <span className={styles.value}>{getNextjsTypeLabel(node.nextjsType)}</span>
            </div>
          )}
          {node.componentType && (
            <div className={styles.info}>
              <span className={styles.label}>Component Type:</span>
              <span className={styles.value}>
                {node.componentType === 'client' && '🖥️ Client'}
                {node.componentType === 'server' && '⚙️ Server'}
                {node.componentType === 'shared' && '🔄 Shared'}
              </span>
            </div>
          )}
          {node.nodeFramework && (
            <div className={styles.info}>
              <span className={styles.label}>Node.js Framework:</span>
              <span className={styles.value}>
                {node.nodeFramework === 'express' && '🟢 Express'}
                {node.nodeFramework === 'nestjs' && '🔴 NestJS'}
                {node.nodeFramework === 'fastify' && '⚡ Fastify'}
              </span>
            </div>
          )}
          {node.moduleSystem && (
            <div className={styles.info}>
              <span className={styles.label}>Module System:</span>
              <span className={styles.value}>
                {node.moduleSystem === 'esm' && '📦 ES Modules'}
                {node.moduleSystem === 'commonjs' && '📦 CommonJS'}
                {node.moduleSystem === 'mixed' && '📦 Mixed'}
              </span>
            </div>
          )}
          {node.routeGroup && (
            <div className={styles.info}>
              <span className={styles.label}>Route Group:</span>
              <span className={styles.value}>({node.routeGroup})</span>
            </div>
          )}
          {node.parallelRoute && (
            <div className={styles.info}>
              <span className={styles.label}>Parallel Route:</span>
              <span className={styles.value}>@{node.parallelRoute}</span>
            </div>
          )}
          {node.interceptingRoute && (
            <div className={styles.info}>
              <span className={styles.label}>Intercepting Route:</span>
              <span className={styles.value}>
                {node.interceptingRoute.type === 'same-level' && '(.) Same Level'}
                {node.interceptingRoute.type === 'one-up' && '(..) One Level Up'}
                {node.interceptingRoute.type === 'two-up' && '(...) Two Levels Up'}
                {node.interceptingRoute.type === 'root' && '(....) Root Level'}
                {node.interceptingRoute.target && ` → ${node.interceptingRoute.target}`}
              </span>
            </div>
          )}
        </div>

        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Metrics</h4>
          <div className={styles.info}>
            <span className={styles.label}>Lines of Code:</span>
            <span className={styles.value}>{formatNumber(node.lines)}</span>
          </div>
          <div className={styles.info}>
            <span className={styles.label}>File Size:</span>
            <span className={styles.value}>{formatFileSize(node.fileSize)}</span>
          </div>
          <div className={styles.info}>
            <span className={styles.label}>Cluster:</span>
            <span className={styles.value}>{node.cluster || 'None'}</span>
          </div>
        </div>

        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Dependencies</h4>
          <div className={styles.info}>
            <span className={styles.label}>Imports:</span>
            <span className={styles.value}>{formatNumber(node.imports)}</span>
          </div>
          <div className={styles.info}>
            <span className={styles.label}>Imported By:</span>
            <span className={styles.value}>{formatNumber(node.importedBy)}</span>
          </div>
          {node.externalDependencies && node.externalDependencies.length > 0 && (
            <div className={styles.info}>
              <span className={styles.label}>External Deps:</span>
              <span className={styles.value}>{formatNumber(node.externalDependencies.length)}</span>
            </div>
          )}
        </div>

        {node.externalDependencies && node.externalDependencies.length > 0 && (
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>External Dependencies</h4>
            <ul className={styles.depList}>
              {node.externalDependencies.map((dep) => (
                <li key={dep} className={styles.depItem}>
                  {dep}
                </li>
              ))}
            </ul>
          </div>
        )}

        {node.serverActions && node.serverActions.length > 0 && (
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Server Actions ({node.serverActions.length})</h4>
            <ul className={styles.depList}>
              {node.serverActions.map((action) => (
                <li key={action} className={styles.depItem}>
                  🔶 {action}
                </li>
              ))}
            </ul>
          </div>
        )}

        {node.dynamicSegments && node.dynamicSegments.length > 0 && (
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Dynamic Segments ({node.dynamicSegments.length})</h4>
            <ul className={styles.depList}>
              {node.dynamicSegments.map((segment, idx) => (
                <li key={idx} className={styles.depItem}>
                  {segment.type === 'single' && `[${segment.name}]`}
                  {segment.type === 'catch-all' && `[...${segment.name}]`}
                  {segment.type === 'optional-catch-all' && `[[...${segment.name}]]`}
                  <span style={{ marginLeft: '8px', opacity: 0.7, fontSize: '0.85em' }}>
                    ({segment.type})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {node.httpMethods && node.httpMethods.length > 0 && (
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>HTTP Methods ({node.httpMethods.length})</h4>
            <div className={styles.flags}>
              {node.httpMethods.map((method) => (
                <span key={method} className={styles.flag}>
                  {method === 'GET' && '🟢'}
                  {method === 'POST' && '🔵'}
                  {method === 'PUT' && '🟡'}
                  {method === 'DELETE' && '🔴'}
                  {method === 'PATCH' && '🟠'}
                  {method === 'OPTIONS' && '⚪'}
                  {method === 'HEAD' && '⚫'}
                  {' '}{method}
                </span>
              ))}
            </div>
          </div>
        )}

        {node.dynamicImports && node.dynamicImports.count > 0 && (
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Dynamic Imports ({node.dynamicImports.count})</h4>
            <ul className={styles.depList}>
              {node.dynamicImports.modules.map((module, idx) => (
                <li key={idx} className={styles.depItem}>
                  📦 {module}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Flags</h4>
          <div className={styles.flags}>
            {node.isTest && <span className={styles.flag}>🧪 Test File</span>}
            {node.isOrphan && <span className={styles.flag}>🔴 Orphan</span>}
            {node.isExternal && <span className={styles.flag}>📦 External</span>}
            {node.serverActions && node.serverActions.length > 0 && (
              <span className={styles.flag}>🔶 Has Server Actions</span>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
};