import React from 'react';
import { NodeSizeMode } from '../../types/components';
import { Select, SelectOption } from '../UI/Select';
import styles from './ColorSchemeSelector.module.css';

export interface NodeSizeSelectorProps {
  value: NodeSizeMode;
  onChange: (mode: NodeSizeMode) => void;
}

const NODE_SIZE_OPTIONS: SelectOption[] = [
  { value: 'default', label: 'Balanced (Lines + Refs)' },
  { value: 'lines', label: 'Lines of Code' },
  { value: 'references', label: 'Total References' }
];

export const NodeSizeSelector: React.FC<NodeSizeSelectorProps> = ({
  value,
  onChange
}) => {
  const handleChange = (newValue: string) => {
    onChange(newValue as NodeSizeMode);
  };

  return (
    <div className={styles.colorSchemeSelector}>
      <Select
        label="Node Size"
        options={NODE_SIZE_OPTIONS}
        value={value}
        onChange={handleChange}
      />
    </div>
  );
};