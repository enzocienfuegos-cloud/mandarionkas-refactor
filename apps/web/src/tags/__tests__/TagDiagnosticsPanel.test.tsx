import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TagDiagnosticsPanel from '../TagDiagnosticsPanel';

describe('TagDiagnosticsPanel', () => {
  it('renders system checks and preserves the detailed diagnostics workflow', () => {
    const onRepublishStaticDelivery = vi.fn();

    render(
      <TagDiagnosticsPanel
        savedTag={{ id: 'tag-1', name: 'Video tag', format: 'VAST' }}
        selectedCampaignDsp="Basis"
        deliveryDiagnostics={{
          dsp: { selected: 'Basis' },
          deliverySummary: {
            deliveryMode: 'basis_native',
            previewStatus: 'basis_preview_may_fallback',
          },
          deliveryDiagnostics: {
            displayWrapper: {
              policy: {
                includeDspHint: true,
                includeClickMacro: true,
                measurementPath: 'basis_first_hop',
              },
              jsUrl: 'https://cdn.example.com/display.js',
            },
            vast: {
              policy: {
                includeDspHint: true,
                includeClickMacro: true,
                measurementPath: 'basis_fallback',
              },
              url: 'https://cdn.example.com/vast.xml',
            },
            trackerClick: {
              policy: {
                includeDspHint: false,
                includeClickMacro: true,
                measurementPath: 'basis_first_hop',
              },
              url: 'https://cdn.example.com/click',
            },
          },
        }}
        deliveryDiagnosticsLoading={false}
        basisNativeEnabled={true}
        dspVideoEnabled={false}
        basisFallbackActive={true}
        basisDiagnosticPath="basis_fallback"
        staticDeliveryEntries={[]}
        copiedStaticProfile={null}
        queueingStaticDelivery={false}
        republishingStaticDelivery={false}
        onCopyStaticProfile={vi.fn()}
        onDownloadStaticProfile={vi.fn()}
        onDownloadAllStaticProfiles={vi.fn()}
        onQueueStaticDelivery={vi.fn()}
        onRepublishStaticDelivery={onRepublishStaticDelivery}
      />,
    );

    expect(screen.getByText('System checks')).toBeTruthy();
    expect(screen.getByText('Selected DSP')).toBeTruthy();
    expect(screen.getAllByText('Delivery Mode').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Preview Status').length).toBeGreaterThan(0);
    expect(screen.getByText('Static Delivery Artifacts')).toBeTruthy();
    expect(screen.getAllByText('Resolved via basis_first_hop.').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Republish' }));
    expect(onRepublishStaticDelivery).toHaveBeenCalledTimes(1);

    expect(screen.getByText('Delivery Diagnostics')).toBeTruthy();
    expect(screen.getByText('Static Delivery URLs')).toBeTruthy();
  });

  it('shows the loading state in the system diagnostics summary', () => {
    render(
      <TagDiagnosticsPanel
        savedTag={{ id: 'tag-2', name: 'Display tag', format: 'display' }}
        selectedCampaignDsp=""
        deliveryDiagnostics={null}
        deliveryDiagnosticsLoading={true}
        basisNativeEnabled={false}
        dspVideoEnabled={false}
        basisFallbackActive={false}
        basisDiagnosticPath=""
        staticDeliveryEntries={[]}
        copiedStaticProfile={null}
        queueingStaticDelivery={false}
        republishingStaticDelivery={false}
        onCopyStaticProfile={vi.fn()}
        onDownloadStaticProfile={vi.fn()}
        onDownloadAllStaticProfiles={vi.fn()}
        onQueueStaticDelivery={vi.fn()}
        onRepublishStaticDelivery={vi.fn()}
      />,
    );

    expect(screen.getByText('Running diagnostics…')).toBeTruthy();
  });
});
