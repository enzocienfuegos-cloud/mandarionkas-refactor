import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

/**
 * Tabs — for switching between different content panels in the same surface.
 * Use when each option reveals a distinct region of UI such as forms,
 * inspectors, or grouped controls.
 *
 * Example: Inspector tabs (Basics / Behavior / Data).
 *
 * For a small in-place filter that narrows existing content without changing
 * the surrounding panel structure, prefer SegmentedControl.
 */
export type TabDefinition<T extends string> = {
  id: T;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
};

type TabsProps<T extends string> = {
  tabs: TabDefinition<T>[];
  activeId: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  idBase?: string;
  className?: string;
};

export function Tabs<T extends string>({
  tabs,
  activeId,
  onChange,
  ariaLabel,
  idBase,
  className = '',
}: TabsProps<T>): JSX.Element {
  const generatedBaseId = useId();
  const baseId = idBase ?? generatedBaseId;
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const enabledTabs = tabs.filter((tab) => !tab.disabled);
    const currentIndex = enabledTabs.findIndex((tab) => tab.id === tabs[index].id);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % enabledTabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = enabledTabs.length - 1;
    const nextTab = enabledTabs[nextIndex];
    if (!nextTab) return;
    onChange(nextTab.id);
    refs.current[nextTab.id]?.focus();
  }

  return (
    <div className={`tabs ${className}`.trim()} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeId;
        const tabId = `${baseId}-tab-${tab.id}`;
        const panelId = `${baseId}-panel-${tab.id}`;
        return (
          <button
            key={tab.id}
            ref={(element) => { refs.current[tab.id] = element; }}
            type="button"
            role="tab"
            id={tabId}
            aria-controls={panelId}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            disabled={tab.disabled}
            className={`tabs__tab ${isActive ? 'is-active' : ''}`.trim()}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.icon ? <span className="tabs__icon">{tab.icon}</span> : null}
            <span className="tabs__label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
