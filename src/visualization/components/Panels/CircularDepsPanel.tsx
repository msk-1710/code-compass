import React, { useState } from 'react';
import { Panel } from '../UI/Panel';
import { CircularDependency } from '../../types/graph';
import { formatPath } from '../../utils/formatters';
import styles from './CircularDepsPanel.module.css';

export interface CircularDepsPanelProps {
  visible: boolean;
  onClose: () => void;
  circularDependencies: CircularDependency[];
  onNodeSelect?: (nodeId: string) => void;
}

export const CircularDepsPanel: React.FC<CircularDepsPanelProps> = ({
  visible,
  onClose,
  circularDependencies,
  onNodeSelect
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const handleNodeClick = (nodeId: string) => {
    if (onNodeSelect) {
      onNodeSelect(nodeId);
      onClose();
    }
  };

  const getSeverityClass = (severity: number) => {
    if (severity >= 4) return styles.severityHigh;
    if (severity >= 3) return styles.severityMedium;
    return styles.severityLow;
  };

  const getSeverityLabel = (severity: number) => {
    if (severity >= 4) return 'High';
    if (severity >= 3) return 'Medium';
    return 'Low';
  };

  return (
    <Panel
      visible={visible}
      onClose={onClose}
      title={`Circular Dependencies (${circularDependencies.length})`}
      className={styles.circularDepsPanel}
    >
      {circularDependencies.length === 0 ? (
        <div className={styles.empty}>
          <p>✅ No circular dependencies found!</p>
          <p className={styles.hint}>Your project has a clean dependency graph.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {circularDependencies.map((dep, index) => (
            <div key={index} className={styles.item}>
              <div
                className={styles.header}
                onClick={() => toggleExpand(index)}
              >
                <span className={styles.icon}>
                  {expandedIndex === index ? '▼' : '▶'}
                </span>
                <span className={styles.title}>
                  Cycle {index + 1} ({dep.cycle.length} files)
                </span>
                <span className={`${styles.severity} ${getSeverityClass(dep.severity)}`}>
                  {getSeverityLabel(dep.severity)}
                </span>
              </div>
              
              {expandedIndex === index && (
                <div className={styles.content}>
                  <div className={styles.cycle}>
                    {dep.cycle.map((nodeId, i) => (
                      <React.Fragment key={i}>
                        <button
                          className={styles.node}
                          onClick={() => handleNodeClick(nodeId)}
                          title={nodeId}
                        >
                          {formatPath(nodeId, 40)}
                        </button>
                        {i < dep.cycle.length - 1 && (
                          <div className={styles.arrow}>↓</div>
                        )}
                        {i === dep.cycle.length - 1 && (
                          <div className={styles.arrow}>↻</div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className={styles.info}>
                    <p className={styles.hint}>
                      Click on a file to highlight it in the graph
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
};