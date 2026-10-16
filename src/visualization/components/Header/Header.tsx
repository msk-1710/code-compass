import React from 'react';
import styles from './Header.module.css';

export interface HeaderProps {
  projectName: string;
  nodeCount: number;
  edgeCount: number;
  circularDepsCount: number;
  legendVisible: boolean;
  onToggleLegend: () => void;
  circularDepsVisible: boolean;
  onToggleCircularDeps: () => void;
  externalDepsVisible: boolean;
  onToggleExternalDeps: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  projectName,
  nodeCount,
  edgeCount,
  circularDepsCount,
  legendVisible,
  onToggleLegend,
  circularDepsVisible,
  onToggleCircularDeps,
  externalDepsVisible,
  onToggleExternalDeps
}) => {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.logoIcon}>🧭</span>
        <span className={styles.brandTitle}>Code Compass</span>
        {projectName && 
         projectName.toLowerCase().replace(/[-_]/g, ' ') !== 'code compass' && (
          <span className={styles.projectBadge} title={`Analyzed Project: ${projectName}`}>
            {projectName}
          </span>
        )}
      </div>

      <div className={styles.statsSection}>
        <div className={styles.statPill} title="Total scanned files / nodes">
          <span>Files:</span>
          <span className={styles.statValue}>{nodeCount}</span>
        </div>
        <div className={styles.statPill} title="Total import connections / edges">
          <span>Imports:</span>
          <span className={styles.statValue}>{edgeCount}</span>
        </div>
        {circularDepsCount > 0 ? (
          <div className={`${styles.statPill} ${styles.cycleAlert}`} title="Circular dependencies detected!">
            <span>⚠️ Cycles:</span>
            <span className={styles.statValue}>{circularDepsCount}</span>
          </div>
        ) : (
          <div className={styles.statPill} title="No circular dependencies found">
            <span>✓ Cycles:</span>
            <span className={styles.statValue}>0</span>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.actionBtn} ${legendVisible ? styles.actionBtnActive : ''}`}
          onClick={onToggleLegend}
          title="Toggle color legend"
        >
          <span>🎨</span>
          <span>Legend</span>
        </button>

        <button
          type="button"
          className={`${styles.actionBtn} ${circularDepsVisible ? styles.actionBtnActive : ''}`}
          onClick={onToggleCircularDeps}
          title="View circular dependencies"
        >
          <span>🔄</span>
          <span>Cycles ({circularDepsCount})</span>
        </button>

        <button
          type="button"
          className={`${styles.actionBtn} ${externalDepsVisible ? styles.actionBtnActive : ''}`}
          onClick={onToggleExternalDeps}
          title="View external dependencies"
        >
          <span>📦</span>
          <span>Packages</span>
        </button>
      </div>
    </header>
  );
};
