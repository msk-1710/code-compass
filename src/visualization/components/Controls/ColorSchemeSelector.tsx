import React from 'react';
import { ColorScheme } from '../../types/graph';
import { Select, SelectOption } from '../UI/Select';
import styles from './ColorSchemeSelector.module.css';

export interface ColorSchemeSelectorProps {
  value: ColorScheme;
  onChange: (scheme: ColorScheme) => void;
}

const COLOR_SCHEME_OPTIONS: SelectOption[] = [
  { value: 'default', label: 'Default Colors' },
  { value: 'nextjs', label: 'Next.js Colors' },
  { value: 'framework', label: 'Framework Colors' },
  { value: 'architecture', label: 'Architecture Colors' },
  { value: 'module-system', label: 'Module System Colors' },
  { value: 'monorepo', label: 'Monorepo Colors' },
  { value: 'test-coverage', label: 'Test Coverage Colors' }
];

export const ColorSchemeSelector: React.FC<ColorSchemeSelectorProps> = ({
  value,
  onChange
}) => {
  const handleChange = (newValue: string) => {
    onChange(newValue as ColorScheme);
  };

  return (
    <div className={styles.colorSchemeSelector}>
      <Select
        label="Color Scheme"
        options={COLOR_SCHEME_OPTIONS}
        value={value}
        onChange={handleChange}
      />
    </div>
  );
};