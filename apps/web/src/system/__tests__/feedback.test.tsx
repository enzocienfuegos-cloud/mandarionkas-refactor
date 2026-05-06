/**
 * Toast + Confirm — unit tests
 *
 * These cover the public hook contract (useToast / useConfirm). They use
 * the same provider setup pages will use, so they double as a usage doc.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ToastProvider, useToast } from '../feedback/Toast';
import { ConfirmProvider, useConfirm } from '../feedback/Confirm';

// ─── Toast ────────────────────────────────────────────────────────────────

function ToastTrigger({ tone = 'success' as const }: { tone?: 'success' | 'critical' | 'info' | 'warning' }) {
  const { toast } = useToast();
  return (
    <button onClick={() => toast({ tone, title: `Hello ${tone}` })}>
      fire {tone}
    </button>
  );
}

describe('Toast', () => {
  it('renders a toast when fired', async () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('fire success'));
    expect(await screen.findByText('Hello success')).toBeInTheDocument();
  });

  it('auto-dismisses after the default duration', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('fire success'));
    expect(screen.getByText('Hello success')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(5000); });

    await waitFor(() => {
      expect(screen.queryByText('Hello success')).not.toBeInTheDocument();
    });
    vi.useRealTimers();
  });

  it('supports a manual dismiss button', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('fire success'));
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText('Hello success')).not.toBeInTheDocument();
  });
});

// ─── Confirm ──────────────────────────────────────────────────────────────

function ConfirmTrigger({ onResult }: { onResult: (ok: boolean) => void }) {
  const confirm = useConfirm();
  return (
    <button
      onClick={async () => {
        const ok = await confirm({
          title: 'Continue?',
          description: 'Are you sure?',
        });
        onResult(ok);
      }}
    >
      ask
    </button>
  );
}

describe('Confirm', () => {
  it('shows the dialog with title and description', async () => {
    render(
      <ConfirmProvider>
        <ConfirmTrigger onResult={() => {}} />
      </ConfirmProvider>,
    );
    fireEvent.click(screen.getByText('ask'));
    expect(await screen.findByText('Continue?')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('resolves true when confirmed', async () => {
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <ConfirmTrigger onResult={onResult} />
      </ConfirmProvider>,
    );
    fireEvent.click(screen.getByText('ask'));
    fireEvent.click(await screen.findByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });

  it('resolves false when cancelled', async () => {
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <ConfirmTrigger onResult={onResult} />
      </ConfirmProvider>,
    );
    fireEvent.click(screen.getByText('ask'));
    fireEvent.click(await screen.findByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it('disables the confirm button until the user types the matching string', async () => {
    function TypeConfirm({ onResult }: { onResult: (ok: boolean) => void }) {
      const confirm = useConfirm();
      return (
        <button
          onClick={async () => {
            const ok = await confirm({
              title: 'Type to confirm',
              tone: 'danger',
              requireTypeToConfirm: 'DELETE',
            });
            onResult(ok);
          }}
        >
          ask
        </button>
      );
    }

    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <TypeConfirm onResult={onResult} />
      </ConfirmProvider>,
    );

    fireEvent.click(screen.getByText('ask'));
    const confirmBtn = await screen.findByRole('button', { name: /confirm/i });
    expect(confirmBtn).toBeDisabled();

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'DELETE' } });
    expect(confirmBtn).not.toBeDisabled();
  });
});
