import React from 'react';
import { PanelProps } from '../../types/components';
import styles from './Panel.module.css';

export const Panel: React.FC<PanelProps> = ({
  visible,
  onClose,
  children,
  title,
  className = ''
}) => {
  if (!visible) return null;

  const classNames = [
    styles.panel,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={classNames} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          {title && <h2 className={styles.title}>{title}</h2>}
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close panel"
          >
            ×
          </button>
        </div>
        <div className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  );
};