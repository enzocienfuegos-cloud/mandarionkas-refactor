import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Tooltip } from './Tooltip';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconBefore?: ReactNode;
  iconAfter?: ReactNode;
  loading?: boolean;
  tooltip?: ReactNode;
  showTooltip?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    iconBefore,
    iconAfter,
    loading = false,
    tooltip,
    showTooltip = true,
    disabled = false,
    className = '',
    children,
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
      className={`btn btn--${variant} btn--${size} ${loading ? 'is-loading' : ''} ${className}`.trim()}
      disabled={disabled || loading}
    >
      {iconBefore ? <span className="btn__icon btn__icon--before">{iconBefore}</span> : null}
      {children ? <span className="btn__label">{children}</span> : null}
      {iconAfter ? <span className="btn__icon btn__icon--after">{iconAfter}</span> : null}
    </button>
  );

  if (!tooltip || !showTooltip) {
    return button;
  }

  return (
    <Tooltip content={tooltip}>
      {button}
    </Tooltip>
  );
});
