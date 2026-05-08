/**
 * Toast + Confirm — unit tests
 *
 * These cover the public hook contract (useToast / useConfirm). They use
 * the same provider setup pages will use, so they double as a usage doc.
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
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

function ToastPromiseTrigger() {
  const { promise } = useToast();
  return (
    <>
      <button
        onClick={() => {
          void promise(Promise.resolve('done'), {
            loading: 'Loading',
            success: (value) => `Success ${value}`,
            error: 'Failed',
          });
        }}
      >
        promise success
      </button>
      <button
        onClick={() => {
          void promise(Promise.reject(new Error('boom')), {
            loading: 'Loading',
            success: 'Success',
            error: (error) => `Error ${(error as Error).message}`,
          }).catch(() => {});
        }}
      >
        promise error
      </button>
    </>
  );
}

describe('Toast', () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('renders a toast when fired', async () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('fire success'));
    expect(await screen.findByText('Hello success')).toBeTruthy();
  });

  it('auto-dismisses after the default duration', async () => {
    vi.useFakeTimers();
    try {
      render(
        <ToastProvider>
          <ToastTrigger />
        </ToastProvider>,
      );
      fireEvent.click(screen.getByText('fire success'));
      expect(screen.getByText('Hello success')).toBeTruthy();

      act(() => { vi.advanceTimersByTime(5000); });

      expect(screen.queryByText('Hello success')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('supports a manual dismiss button', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('fire success'));
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText('Hello success')).toBeNull();
  });

  it('uses assertive live regions for critical toasts and caps visible toasts', async () => {
    function Burst() {
      const { toast } = useToast();
      return (
        <button
          onClick={() => {
            for (let index = 0; index < 6; index += 1) {
              toast({ tone: 'info', title: `Toast ${index}` });
            }
            toast({ tone: 'critical', title: 'Critical issue' });
          }}
        >
          burst
        </button>
      );
    }

    render(
      <ToastProvider>
        <Burst />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('burst'));
    expect(await screen.findByText('Critical issue')).toBeTruthy();
    expect(screen.getByText('Critical issue').closest('[role="alert"]')?.getAttribute('aria-live')).toBe('assertive');
    expect(screen.queryByText('Toast 0')).toBeNull();
    expect(screen.queryAllByRole('status').length + screen.queryAllByRole('alert').length).toBeLessThanOrEqual(5);
  });

  it('supports toast.promise for success and failure flows', async () => {
    render(
      <ToastProvider>
        <ToastPromiseTrigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('promise success'));
    expect(await screen.findByText('Success done')).toBeTruthy();

    fireEvent.click(screen.getByText('promise error'));
    expect(await screen.findByText('Error boom')).toBeTruthy();
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
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Continue?')).toBeTruthy();
    expect(screen.getByText('Are you sure?')).toBeTruthy();
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
    const confirmBtn = await screen.findByRole('button', { name: /delete/i });
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'DELETE' } });
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(false);
  });
});
