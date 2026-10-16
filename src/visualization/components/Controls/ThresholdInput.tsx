import React from 'react';
import { Tooltip } from '../UI/Tooltip';
import styles from './ThresholdInput.module.css';

interface ThresholdInputProps {
  label: string;
  value: number;
  enabled: boolean;
  onValueChange: (value: number) => void;
  onEnabledChange: (enabled: boolean) => void;
  min?: number;
  max?: number;
  step?: number;
  icon?: string;
  tooltip?: string;
}

export const ThresholdInput: React.FC<ThresholdInputProps> = ({
  label,
  value,
  enabled,
  onValueChange,
  onEnabledChange,
  min = 0,
  max = 1000,
  step = 1,
  icon,
  tooltip
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    if (!isNaN(newValue)) {
      onValueChange(newValue);
    }
  };

  const containerClasses = [
    styles.thresholdInput,
    enabled ? styles.active : ''
  ].filter(Boolean).join(' ');

  const content = (
    <div className={containerClasses}>
      <button
        type="button"
        className={styles.header}
        onClick={() => onEnabledChange(!enabled)}
      >
        {icon && <span className={styles.icon}>{icon}</span>}
        <span className={styles.label}>{label}</span>
        {enabled && <span className={styles.value}>≥ {value}</span>}
      </button>
      {enabled && (
        <div className={styles.inputGroup}>
          <input
            type="number"
            value={value}
            onChange={handleInputChange}
            min={min}
            max={max}
            step={step}
            className={styles.numberInput}
            onClick={(e) => e.stopPropagation()}
          />
          <input
            type="range"
            value={value}
            onChange={handleInputChange}
            min={min}
            max={max}
            step={step}
            className={styles.rangeInput}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );

  if (tooltip) {
    return <Tooltip content={tooltip}>{content}</Tooltip>;
  }

  return content;
};