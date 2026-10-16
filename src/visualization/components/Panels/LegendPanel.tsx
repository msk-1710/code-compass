import React from 'react';
import { Panel } from '../UI/Panel';
import { ColorScheme, GraphNode } from '../../types/graph';
import { getLegendItems } from '../../utils/colorSchemes';
import styles from './LegendPanel.module.css';

export interface LegendPanelProps {
  visible: boolean;
  onClose: () => void;
  colorScheme: ColorScheme;
  nodes?: GraphNode[];
}

export const LegendPanel: React.FC<LegendPanelProps> = ({
  visible,
  onClose,
  colorScheme,
  nodes
}) => {
  const legendItems = getLegendItems(colorScheme, nodes);

  return (
    <Panel
      visible={visible}
      onClose={onClose}
      title="Legend"
      className={styles.legendPanel}
    >
      <div className={styles.legendItems}>
        {legendItems.map((item) => (
          <div key={item.label} className={styles.legendItem}>
            <div
              className={styles.colorBox}
              style={{ backgroundColor: item.color }}
            />
            <span className={styles.label}>{item.label}</span>
          </div>
        ))}
      </div>

      {colorScheme === 'nextjs' && (
        <>
          <div className={styles.divider} />
          <div className={styles.routingSection}>
            <h4 className={styles.routingSectionTitle}>Routing Features</h4>
            <div className={styles.routingItems}>
              <div className={styles.routingItem}>
                <span className={styles.routingSymbol}>(group)</span>
                <span className={styles.routingLabel}>Route Group</span>
              </div>
              <div className={styles.routingItem}>
                <span className={styles.routingSymbol}>[slug]</span>
                <span className={styles.routingLabel}>Dynamic Route</span>
              </div>
              <div className={styles.routingItem}>
                <span className={styles.routingSymbol}>@slot</span>
                <span className={styles.routingLabel}>Parallel Route</span>
              </div>
              <div className={styles.routingItem}>
                <span className={styles.routingSymbol}>(..)</span>
                <span className={styles.routingLabel}>Intercepting Route</span>
              </div>
              <div className={styles.routingItem}>
                <span className={styles.routingSymbol}>🟢 GET</span>
                <span className={styles.routingLabel}>API Route Method</span>
              </div>
            </div>
          </div>
        </>
      )}
    </Panel>
  );
};