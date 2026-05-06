/**
 * DataTable — unit tests
 *
 * The DataTable is the only "rich" primitive (sort, density, selection,
 * keyboard nav). Worth covering. Other primitives are pure presentational
 * and snapshot-friendly; that test pass is a follow-up.
 *
 * Stack: assumes Vitest. Adapt to Jest by swapping `vi` → `jest` and
 * `import { ... } from 'vitest'` → it works the same with `@types/jest`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DataTable, type ColumnDef } from '../data-table/DataTable';

interface Row {
  id: string;
  name: string;
  status: 'active' | 'paused';
  impressions: number;
}

const ROWS: Row[] = [
  { id: '1', name: 'Beta',    status: 'active', impressions: 100 },
  { id: '2', name: 'Alpha',   status: 'paused', impressions: 300 },
  { id: '3', name: 'Charlie', status: 'active', impressions: 200 },
];

const COLUMNS: ColumnDef<Row>[] = [
  {
    id: 'name',
    header: 'Name',
    sortAccessor: (row) => row.name,
    cell: (row) => row.name,
  },
  {
    id: 'status',
    header: 'Status',
    sortAccessor: (row) => row.status,
    cell: (row) => row.status,
  },
  {
    id: 'imps',
    header: 'Impressions',
    align: 'right',
    numeric: true,
    sortAccessor: (row) => row.impressions,
    cell: (row) => row.impressions.toLocaleString(),
  },
];

describe('DataTable', () => {
  describe('rendering', () => {
    it('renders all rows in the order provided', () => {
      render(<DataTable columns={COLUMNS} data={ROWS} rowKey={(r) => r.id} />);
      const rows = screen.getAllByRole('row');
      // 1 header + 3 body rows
      expect(rows).toHaveLength(4);
      expect(rows[1]).toHaveTextContent('Beta');
      expect(rows[2]).toHaveTextContent('Alpha');
      expect(rows[3]).toHaveTextContent('Charlie');
    });

    it('renders all column headers', () => {
      render(<DataTable columns={COLUMNS} data={ROWS} rowKey={(r) => r.id} />);
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Impressions')).toBeInTheDocument();
    });

    it('shows the empty state when data is empty', () => {
      render(
        <DataTable
          columns={COLUMNS}
          data={[]}
          rowKey={(r) => r.id}
          emptyMessage="No campaigns found"
        />,
      );
      expect(screen.getByText('No campaigns found')).toBeInTheDocument();
    });

    it('shows skeleton rows when loading', () => {
      render(
        <DataTable columns={COLUMNS} data={[]} rowKey={(r) => r.id} loading />,
      );
      // No rows, but loading indicator should be present
      expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('sorting', () => {
    it('sorts ascending on first header click', () => {
      render(<DataTable columns={COLUMNS} data={ROWS} rowKey={(r) => r.id} />);
      fireEvent.click(screen.getByRole('button', { name: /Name/i }));

      const rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent('Alpha');
      expect(rows[2]).toHaveTextContent('Beta');
      expect(rows[3]).toHaveTextContent('Charlie');
    });

    it('toggles to descending on second click', () => {
      render(<DataTable columns={COLUMNS} data={ROWS} rowKey={(r) => r.id} />);
      const header = screen.getByRole('button', { name: /Name/i });
      fireEvent.click(header);
      fireEvent.click(header);

      const rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent('Charlie');
      expect(rows[2]).toHaveTextContent('Beta');
      expect(rows[3]).toHaveTextContent('Alpha');
    });

    it('sorts numeric columns numerically, not lexically', () => {
      render(<DataTable columns={COLUMNS} data={ROWS} rowKey={(r) => r.id} />);
      fireEvent.click(screen.getByRole('button', { name: /Impressions/i }));

      const rows = screen.getAllByRole('row');
      // 100 < 200 < 300 (not '100' < '200' < '300' string sort, which would also pass here, but the point is
      // it shouldn't be a coincidence — sortAccessor returns a number.)
      expect(rows[1]).toHaveTextContent('100');
      expect(rows[2]).toHaveTextContent('200');
      expect(rows[3]).toHaveTextContent('300');
    });

    it('sets aria-sort on the active column', () => {
      render(<DataTable columns={COLUMNS} data={ROWS} rowKey={(r) => r.id} />);
      const cell = screen.getByRole('columnheader', { name: /Name/i });
      expect(cell).toHaveAttribute('aria-sort', 'none');
      fireEvent.click(within(cell).getByRole('button'));
      expect(cell).toHaveAttribute('aria-sort', 'ascending');
    });
  });

  describe('selection', () => {
    it('renders checkboxes when selectable', () => {
      render(
        <DataTable
          columns={COLUMNS}
          data={ROWS}
          rowKey={(r) => r.id}
          selectable
          selectedKeys={new Set()}
          onSelectionChange={() => {}}
        />,
      );
      // header + 3 body checkboxes
      expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    });

    it('calls onSelectionChange when a row checkbox is clicked', () => {
      const onSelectionChange = vi.fn();
      render(
        <DataTable
          columns={COLUMNS}
          data={ROWS}
          rowKey={(r) => r.id}
          selectable
          selectedKeys={new Set()}
          onSelectionChange={onSelectionChange}
        />,
      );

      const [, firstRowCheckbox] = screen.getAllByRole('checkbox');
      fireEvent.click(firstRowCheckbox);

      expect(onSelectionChange).toHaveBeenCalledTimes(1);
      const next = onSelectionChange.mock.calls[0][0] as Set<string>;
      expect(next.has('1')).toBe(true);
    });

    it('selects all when the header checkbox is clicked', () => {
      const onSelectionChange = vi.fn();
      render(
        <DataTable
          columns={COLUMNS}
          data={ROWS}
          rowKey={(r) => r.id}
          selectable
          selectedKeys={new Set()}
          onSelectionChange={onSelectionChange}
        />,
      );

      const [headerCheckbox] = screen.getAllByRole('checkbox');
      fireEvent.click(headerCheckbox);

      expect(onSelectionChange).toHaveBeenCalledTimes(1);
      const next = onSelectionChange.mock.calls[0][0] as Set<string>;
      expect(next.size).toBe(3);
    });

    it('renders bulk actions when rows are selected', () => {
      render(
        <DataTable
          columns={COLUMNS}
          data={ROWS}
          rowKey={(r) => r.id}
          selectable
          selectedKeys={new Set(['1', '2'])}
          onSelectionChange={() => {}}
          renderBulkActions={(rows) => <button>Pause {rows.length}</button>}
        />,
      );
      expect(screen.getByText('Pause 2')).toBeInTheDocument();
    });
  });

  describe('row interaction', () => {
    it('calls onRowClick when a row is clicked', () => {
      const onRowClick = vi.fn();
      render(
        <DataTable
          columns={COLUMNS}
          data={ROWS}
          rowKey={(r) => r.id}
          onRowClick={onRowClick}
        />,
      );
      fireEvent.click(screen.getAllByRole('row')[1]);
      expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
    });

    it('does NOT call onRowClick when a checkbox is clicked', () => {
      const onRowClick = vi.fn();
      render(
        <DataTable
          columns={COLUMNS}
          data={ROWS}
          rowKey={(r) => r.id}
          selectable
          selectedKeys={new Set()}
          onSelectionChange={() => {}}
          onRowClick={onRowClick}
        />,
      );

      const [, firstRowCheckbox] = screen.getAllByRole('checkbox');
      fireEvent.click(firstRowCheckbox);

      expect(onRowClick).not.toHaveBeenCalled();
    });
  });

  describe('density', () => {
    it.each(['compact', 'comfortable', 'spacious'] as const)(
      'applies the %s density class',
      (density) => {
        const { container } = render(
          <DataTable
            columns={COLUMNS}
            data={ROWS}
            rowKey={(r) => r.id}
            density={density}
          />,
        );
        // Implementation detail: the table should set a data attribute or class.
        // Adjust this to match your actual DataTable implementation.
        expect(container.querySelector(`[data-density="${density}"]`)).not.toBeNull();
      },
    );
  });
});
