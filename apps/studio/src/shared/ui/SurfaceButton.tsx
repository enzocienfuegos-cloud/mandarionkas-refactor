import { forwardRef, type ButtonHTMLAttributes } from 'react';

type SurfaceButtonVariant = 'ghost' | 'primary' | 'danger';
type SurfaceButtonSize = 'sm' | 'md' | 'lg';
type SurfaceButtonLayout = 'inline' | 'stack';

type SurfaceButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: SurfaceButtonVariant;
  size?: SurfaceButtonSize;
  layout?: SurfaceButtonLayout;
  isActive?: boolean;
};

export const SurfaceButton = forwardRef<HTMLButtonElement, SurfaceButtonProps>(function SurfaceButton(
  {
    variant = 'ghost',
    size = 'md',
    layout = 'inline',
    isActive = false,
    className = '',
    type,
    ...rest
  },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type ?? 'button'}
      className={`surface-btn surface-btn--${variant} surface-btn--${size} surface-btn--${layout} ${isActive ? 'is-active' : ''} ${className}`.trim()}
    />
  );
});
