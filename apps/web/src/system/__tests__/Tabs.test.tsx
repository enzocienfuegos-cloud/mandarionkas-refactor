import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Tab, TabPanel, Tabs, TabsList } from '../primitives/Tabs';

function TabsHarness() {
  const [value, setValue] = React.useState('general');

  return (
    <Tabs value={value} onValueChange={setValue} urlParam="tab">
      <TabsList aria-label="Settings tabs">
        <Tab value="general">General</Tab>
        <Tab value="advanced">Advanced</Tab>
      </TabsList>
      <TabPanel value="general">General content</TabPanel>
      <TabPanel value="advanced">Advanced content</TabPanel>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('hydrates the active tab from the URL param and writes back on change', async () => {
    window.history.replaceState({}, '', '/settings?tab=advanced');
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});

    render(<TabsHarness />);

    await waitFor(() => {
      expect(screen.getByText('Advanced content')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'General' }));

    expect(screen.getByText('General content')).toBeTruthy();
    const nextUrl = replaceStateSpy.mock.calls.at(-1)?.[2];
    expect(String(nextUrl)).toContain('tab=general');
  });
});
