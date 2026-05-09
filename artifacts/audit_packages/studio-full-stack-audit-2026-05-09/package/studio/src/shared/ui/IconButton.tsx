import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Tooltip } from './Tooltip';

type IconButtonVariant = 'ghost' | 'solid' | 'danger';
type IconButtonSize = 'sm' | 'md' | 'lg';

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  label: string;
  icon: ReactNode;
  isActive?: boolean;
  tooltip?: ReactNode;
  showTooltip?: boolean;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    variant = 'ghost',
    size = 'md',
    label,
    icon,
    isActive = false,
    tooltip,
    showTooltip = true,
    className = '',
    type,
    ...rest
  },
  ref,
) {
  const button = (
    <button
      {...rest}
      ref={ref}
      type={type ?? 'button'}
      className={`icon-btn icon-btn--${variant} icon-btn--${size} ${isActive ? 'is-active' : ''} ${className}`.trim()}
      aria-label={label}
      aria-pressed={isActive}
    >
      {icon}
    </button>
  );

  if (!showTooltip) {
    return button;
  }

  return (
    <Tooltip content={tooltip ?? label}>
      {button}
    </Tooltip>
  );
});
