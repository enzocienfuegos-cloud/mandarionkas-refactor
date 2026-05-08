import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';

type TooltipProps = {
  content: ReactNode;
  children: ReactElement;
  disabled?: boolean;
  placement?: 'top' | 'bottom';
};

export function Tooltip({
  content,
  children,
  disabled = false,
  placement = 'top',
}: TooltipProps): JSX.Element {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);

  if (disabled || !content || !isValidElement(children)) {
    return <>{children}</>;
  }

  const child = cloneElement(children as ReactElement<Record<string, unknown>>, {
    'aria-describedby': tooltipId,
  });

  const show = (_event?: MouseEvent<HTMLSpanElement> | FocusEvent<HTMLSpanElement>) => setOpen(true);
  const hide = (_event?: MouseEvent<HTMLSpanElement> | FocusEvent<HTMLSpanElement>) => setOpen(false);

  return (
    <span
      className="tooltip-shell"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {child}
      <span
        id={tooltipId}
        role="tooltip"
        hidden={!open}
        aria-hidden={!open}
        className={`tooltip-bubble tooltip-bubble--${placement}`}
      >
        {content}
      </span>
    </span>
  );
}
