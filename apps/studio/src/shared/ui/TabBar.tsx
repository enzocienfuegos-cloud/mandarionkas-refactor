type TabBarProps<T extends string> = {
  tabs: Array<{ id: T; label: string; count?: number }>;
  activeTab: T;
  onSelectTab(tabId: T): void;
  ariaLabel?: string;
};

export function TabBar<T extends string>({
  tabs,
  activeTab,
  onSelectTab,
  ariaLabel = 'Sections',
}: TabBarProps<T>): JSX.Element {
  return (
    <nav className="tab-bar" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === activeTab}
          className={`tab-bar__tab ${tab.id === activeTab ? 'is-active' : ''}`.trim()}
          onClick={() => onSelectTab(tab.id)}
        >
          <span className="tab-bar__label">{tab.label}</span>
          {typeof tab.count === 'number' ? <span className="tab-bar__count">{tab.count}</span> : null}
        </button>
      ))}
    </nav>
  );
}
