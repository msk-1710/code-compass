import React from 'react';
import { Button, ButtonProps } from '../UI/Button';
import { Tooltip } from '../UI/Tooltip';
import styles from './ToggleButton.module.css';

export interface ToggleButtonProps extends Omit<ButtonProps, 'variant'> {
  active: boolean;
  label: string;
  icon?: string;
  tooltip?: string;
}

export const ToggleButton: React.FC<ToggleButtonProps> = ({
  active,
  label,
  icon,
  tooltip,
  className = '',
  ...props
}) => {
  const classNames = [
    styles.toggleButton,
    active ? styles.active : '',
    className
  ].filter(Boolean).join(' ');

  const button = (
    <Button
      variant={active ? 'primary' : 'secondary'}
      className={classNames}
      {...props}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.label}>{label}</span>
    </Button>
  );

  if (tooltip) {
    return <Tooltip content={tooltip}>{button}</Tooltip>;
  }

  return button;
};