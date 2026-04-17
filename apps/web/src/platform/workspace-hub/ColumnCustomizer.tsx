import type { JSX } from 'react';
import { ColumnsIcon, PlusIcon } from './icons';
import type { WorkspaceProjectColumn } from './types';

type ColumnOption = {
  id: WorkspaceProjectColumn;
  label: string;
};

type ColumnCustomizerProps = {
  open: boolean;
  options: ColumnOption[];
  visibleColumns: WorkspaceProjectColumn[];
  onToggleColumn(column: WorkspaceProjectColumn): void;
};

const quickFields: Array<{ id: WorkspaceProjectColumn | 'more'; label: string }> = [
  { id: 'priority', label: 'Priority' },
  { id: 'dueDate', label: 'Due date' },
  { id: 'channel', label: 'Channel' },
  { id: 'version', label: 'Version' },
  { id: 'more', label: 'More' },
];

export function ColumnCustomizer({ open, options, visibleColumns, onToggleColumn }: ColumnCustomizerProps): JSX.Element | null {
  if (!open) return null;

  return (
    <div className="workspace-admin-flyout">
      <div className="workspace-admin-flyout-head">
        <span className="workspace-admin-flyout-icon"><ColumnsIcon className="workspace-admin-inline-icon" /></span>
        <div>
          <strong>Customize columns</strong>
          <p>Choose the metadata that matters in this workspace.</p>
        </div>
      </div>
      <div className="workspace-admin-column-grid">
        {options.map((option) => (
          <label key={option.id} className="workspace-admin-column-option">
            <input
              checked={visibleColumns.includes(option.id)}
              onChange={() => onToggleColumn(option.id)}
              type="checkbox"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <div className="workspace-admin-flyout-footer">
        <div className="workspace-admin-flyout-footer-title">Add custom field</div>
        <div className="workspace-admin-chip-row">
          {quickFields.map((field) => (
            <button
              key={field.id}
              className="workspace-admin-chip-button"
              type="button"
              onClick={() => {
                if (field.id !== 'more') onToggleColumn(field.id);
              }}
            >
              <PlusIcon className="workspace-admin-inline-icon" />
              {field.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
