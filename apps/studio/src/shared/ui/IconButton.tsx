import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Tooltip } from './Tooltip';

type IconButtonVariant = 'ghost' | 'solid' | 'danger';
type IconButtonSize = 'sm' | 'md' | 'lg';
type TooltipPlacement = 'top' | 'bottom';

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  label: string;
  icon: ReactNode;
  isActive?: boolean;
  pressed?: boolean;
  tooltip?: ReactNode;
  showTooltip?: boolean;
  tooltipPlacement?: TooltipPlacement;
  tooltipDelay?: number;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    variant = 'ghost',
    size = 'md',
    label,
    icon,
    isActive = false,
    pressed,
    tooltip,
    showTooltip = true,
    tooltipPlacement = 'top',
    tooltipDelay,
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
      aria-pressed={pressed}
    >
      {icon}
    </button>
  );

  if (!showTooltip) {
    return button;
  }

  return (
    <Tooltip content={tooltip ?? label} placement={tooltipPlacement} delay={tooltipDelay}>
      {button}
    </Tooltip>
  );
});
