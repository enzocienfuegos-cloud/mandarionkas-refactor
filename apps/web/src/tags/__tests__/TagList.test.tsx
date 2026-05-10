import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TagList from '../TagList';
import { ToastProvider } from '../../system/feedback/Toast';
import { ConfirmProvider } from '../../system/feedback/Confirm';

const TAGS_PAYLOAD = {
  tags: [
    {
      id: '17341e7f-79c2-4fc4-a6b0-2793c7fd814b',
      workspaceId: 'b9897513-b8ce-4178-8220-c5585c33b3fb',
      workspaceName: 'Signalmix',
      campaignId: '13b251d4-84f8-408e-b7b8-0de05bb22146',
      name: 'Bueno 1',
      format: 'display',
      status: 'active',
      campaign: { id: '13b251d4-84f8-408e-b7b8-0de05bb22146', name: 'Bueno', metadata: { dsp: 'Basis', mediaType: 'display' } },
      assignedCount: 0,
      assignedNames: '',
      createdAt: '2026-05-07T18:09:54.175Z',
      updatedAt: '2026-05-07T18:10:16.671Z',
      servingWidth: 300,
      servingHeight: 250,
      sizeLabel: '300x250',
      trackerType: null,
      clickUrl: '',
    },
    {
      id: '651b1fd4-bbd1-46db-8c05-897d9a0196e0',
      workspaceId: 'b9897513-b8ce-4178-8220-c5585c33b3fb',
      workspaceName: 'Signalmix',
      campaignId: 'e26b408d-8f79-437b-8736-f84d35524ebf',
      name: 'Video',
      format: 'VAST',
      status: 'active',
      campaign: { id: 'e26b408d-8f79-437b-8736-f84d35524ebf', name: 'Video', metadata: { dsp: 'Basis', mediaType: 'video' } },
      assignedCount: 0,
      assignedNames: '',
      createdAt: '2026-05-07T18:09:54.175Z',
      updatedAt: '2026-05-07T18:10:16.671Z',
      servingWidth: null,
      servingHeight: null,
      sizeLabel: '',
      trackerType: null,
      clickUrl: '',
    },
  ],
};

const WORKSPACES_PAYLOAD = {
  workspaces: [
    {
      id: 'b9897513-b8ce-4178-8220-c5585c33b3fb',
      name: 'Signalmix',
      product_access: { ad_server: true, studio: true },
    },
  ],
};

const SESSION_PAYLOAD = {
  authenticated: true,
  user: {
    id: '4feca619-d44a-4fcc-b69c-8b3f07c3f60e',
    email: 'admin@smx.studio',
    name: 'SMX Admin',
    role: 'admin',
  },
  activeWorkspaceId: 'b9897513-b8ce-4178-8220-c5585c33b3fb',
  workspaces: WORKSPACES_PAYLOAD.workspaces,
  productAccess: { ad_server: true, studio: true },
  permissions: ['projects:create', 'projects:save', 'projects:delete', 'audit:read'],
};

function renderTagList() {
  return render(
    <ToastProvider>
      <ConfirmProvider>
        <MemoryRouter initialEntries={['/tags']}>
          <Routes>
            <Route path="/tags" element={<TagList />} />
          </Routes>
        </MemoryRouter>
      </ConfirmProvider>
    </ToastProvider>,
  );
}

describe('TagList', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/v1/tags?scope=all')) {
        return new Response(JSON.stringify(TAGS_PAYLOAD), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.endsWith('/v1/workspaces')) {
        return new Response(JSON.stringify(WORKSPACES_PAYLOAD), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.endsWith('/v1/auth/session')) {
        return new Response(JSON.stringify(SESSION_PAYLOAD), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.endsWith('/v1/saved-views?surface=tags')) {
        return new Response(JSON.stringify({ ok: true, views: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.endsWith('/v1/preferences')) {
        return new Response(JSON.stringify({ preferences: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      throw new Error(`Unhandled fetch in TagList test: ${url}`);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders staging-like tags payload without crashing', async () => {
    renderTagList();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tags' })).toBeTruthy();
    });

    expect(screen.getByText('Bueno 1')).toBeTruthy();
    expect(screen.getByText('Video')).toBeTruthy();
    expect(screen.getByRole('button', { name: /saved views/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /health/i })).toBeTruthy();
  });
});
