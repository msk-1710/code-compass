import React, { useState, useMemo } from 'react';
import { Panel } from '../UI/Panel';
import { formatNumber, pluralize } from '../../utils/formatters';
import styles from './ExternalDepsPanel.module.css';

export interface ExternalDepsPanelProps {
  visible: boolean;
  onClose: () => void;
  externalDependencies: Map<string, string[]>;
  onNodeSelect?: (nodeId: string) => void;
}

export const ExternalDepsPanel: React.FC<ExternalDepsPanelProps> = ({
  visible,
  onClose,
  externalDependencies,
  onNodeSelect
}) => {
  const [expandedDep, setExpandedDep] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'usage'>('usage');

  const sortedDeps = useMemo(() => {
    const entries = Array.from(externalDependencies.entries());
    
    if (sortBy === 'usage') {
      return entries.sort((a, b) => b[1].length - a[1].length);
    } else {
      return entries.sort((a, b) => a[0].localeCompare(b[0]));
    }
  }, [externalDependencies, sortBy]);

  const toggleExpand = (dep: string) => {
    setExpandedDep(expandedDep === dep ? null : dep);
  };

  const handleNodeClick = (nodeId: string) => {
    if (onNodeSelect) {
      onNodeSelect(nodeId);
      onClose();
    }
  };

  const totalUsages = useMemo(() => {
    return Array.from(externalDependencies.values()).reduce(
      (sum, files) => sum + files.length,
      0
    );
  }, [externalDependencies]);

  return (
    <Panel
      visible={visible}
      onClose={onClose}
      title={`External Dependencies (${externalDependencies.size})`}
      className={styles.externalDepsPanel}
    >
      <div className={styles.header}>
        <div className={styles.stats}>
          <span className={styles.stat}>
            {formatNumber(externalDependencies.size)} {pluralize(externalDependencies.size, 'package')}
          </span>
          <span className={styles.stat}>
            {formatNumber(totalUsages)} {pluralize(totalUsages, 'usage')}
          </span>
        </div>
        <div className={styles.sortButtons}>
          <button
            className={`${styles.sortButton} ${sortBy === 'usage' ? styles.active : ''}`}
            onClick={() => setSortBy('usage')}
          >
            By Usage
          </button>
          <button
            className={`${styles.sortButton} ${sortBy === 'name' ? styles.active : ''}`}
            onClick={() => setSortBy('name')}
          >
            By Name
          </button>
        </div>
      </div>

      <div className={styles.list}>
        {sortedDeps.map(([dep, files]) => (
          <div key={dep} className={styles.item}>
            <div
              className={styles.depHeader}
              onClick={() => toggleExpand(dep)}
            >
              <span className={styles.icon}>
                {expandedDep === dep ? '▼' : '▶'}
              </span>
              <span className={styles.depName}>{dep}</span>
              <span className={styles.usageCount}>
                {files.length} {pluralize(files.length, 'file')}
              </span>
            </div>
            
            {expandedDep === dep && (
              <div className={styles.fileList}>
                {files.map((file) => (
                  <button
                    key={file}
                    className={styles.fileItem}
                    onClick={() => handleNodeClick(file)}
                    title={file}
                  >
                    {file}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {externalDependencies.size === 0 && (
        <div className={styles.empty}>
          <p>No external dependencies found</p>
        </div>
      )}
    </Panel>
  );
};