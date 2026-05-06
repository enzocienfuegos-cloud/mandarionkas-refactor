import React, { createContext, useContext, useId, useRef } from 'react';
import { cn } from '../cn';

interface TabsContextValue {
  value: string;
  onChange: (value: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs subcomponents must be used inside <Tabs>');
  return ctx;
}

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Accessible tabs with keyboard navigation (Arrow keys, Home/End).
 *
 * @example
 *   <Tabs value={tab} onValueChange={setTab}>
 *     <TabsList>
 *       <Tab value="general">General</Tab>
 *       <Tab value="advanced">Advanced</Tab>
 *     </TabsList>
 *     <TabPanel value="general">...</TabPanel>
 *     <TabPanel value="advanced">...</TabPanel>
 *   </Tabs>
 */
export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  const baseId = useId();
  return (
    <TabsContext.Provider value={{ value, onChange: onValueChange, baseId }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className, 'aria-label': ariaLabel }: {
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const list = listRef.current;
    if (!list) return;
    const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'));
    if (!tabs.length) return;
    const currentIndex = tabs.findIndex((t) => t === document.activeElement);

    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    tabs[nextIndex]?.focus();
    tabs[nextIndex]?.click();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg bg-surface-muted p-1',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface TabProps {
  value: string;
  children: React.ReactNode;
  disabled?: boolean;
  leadingIcon?: React.ReactNode;
  className?: string;
}

export function Tab({ value, children, disabled, leadingIcon, className }: TabProps) {
  const { value: activeValue, onChange, baseId } = useTabsContext();
  const isActive = activeValue === value;
  const tabId    = `${baseId}-tab-${value}`;
  const panelId  = `${baseId}-panel-${value}`;

  return (
    <button
      role="tab"
      type="button"
      id={tabId}
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={() => onChange(value)}
      className={cn(
        'inline-flex items-center gap-2 rounded-md px-3 h-8 text-sm font-medium',
        'transition-colors duration-base ease-standard',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        isActive
          ? 'bg-surface-1 text-[color:var(--dusk-text-primary)] shadow-1'
          : 'text-[color:var(--dusk-text-muted)] hover:text-[color:var(--dusk-text-primary)]',
        className,
      )}
    >
      {leadingIcon && <span className="[&>svg]:h-4 [&>svg]:w-4">{leadingIcon}</span>}
      {children}
    </button>
  );
}

export interface TabPanelProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabPanel({ value, children, className }: TabPanelProps) {
  const { value: activeValue, baseId } = useTabsContext();
  if (activeValue !== value) return null;

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      className={cn('mt-4', className)}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
