import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from '../primitives/Button';
import { Modal } from '../primitives/Modal';

describe('Modal', () => {
  it('renders legacy header API', () => {
    render(
      <Modal open onClose={() => {}} title="Publish tag" description="Review before handoff">
        <div>Body</div>
      </Modal>,
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Publish tag')).toBeTruthy();
    expect(screen.getByText('Review before handoff')).toBeTruthy();
  });

  it('supports compound sections', () => {
    render(
      <Modal open onClose={() => {}} size="lg">
        <Modal.Header>
          <div>Compound header</div>
        </Modal.Header>
        <Modal.Body>
          <div>Compound body</div>
        </Modal.Body>
        <Modal.Footer>
          <Button>Save</Button>
        </Modal.Footer>
      </Modal>,
    );

    expect(screen.getByText('Compound header')).toBeTruthy();
    expect(screen.getByText('Compound body')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('restores body styles exactly after close', () => {
    document.body.style.overflow = 'clip';
    document.body.style.paddingRight = '7px';
    const { rerender } = render(
      <Modal open onClose={() => {}} title="Body lock">
        <div>Body</div>
      </Modal>,
    );

    rerender(
      <Modal open={false} onClose={() => {}} title="Body lock">
        <div>Body</div>
      </Modal>,
    );

    expect(document.body.style.overflow).toBe('clip');
    expect(document.body.style.paddingRight).toBe('7px');
  });

  it('keeps body locked until the last overlay closes', () => {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    const { rerender } = render(
      <>
        <Modal open onClose={() => {}} title="One">
          <div>One</div>
        </Modal>
        <Modal open onClose={() => {}} title="Two">
          <div>Two</div>
        </Modal>
      </>,
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <>
        <Modal open={false} onClose={() => {}} title="One">
          <div>One</div>
        </Modal>
        <Modal open onClose={() => {}} title="Two">
          <div>Two</div>
        </Modal>
      </>,
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <>
        <Modal open={false} onClose={() => {}} title="One">
          <div>One</div>
        </Modal>
        <Modal open={false} onClose={() => {}} title="Two">
          <div>Two</div>
        </Modal>
      </>,
    );

    expect(document.body.style.overflow).toBe('');
  });

  it('closes on escape by default', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Dismissible">
        <div>Body</div>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
