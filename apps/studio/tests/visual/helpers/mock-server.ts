import type { Page } from '@playwright/test';

const MOCK_RESPONSES: Record<string, unknown> = {
  '/v1/hub/overview': {
    overview: {
      workspaceMetrics: [
        {
          workspaceId: 'ws_retail',
          name: 'Retail Group',
          projectCount: 12,
          openCount: 41,
          saveCount: 28,
          versionSaveCount: 14,
          exportCount: 9,
          shareCount: 3,
        },
      ],
      topProjects: [
        {
          id: 'proj_retail_1',
          workspaceId: 'ws_retail',
          workspaceName: 'Retail Group',
          name: 'Spring launch',
          brandName: 'Retail Group',
          campaignName: 'Q2 Promo',
          ownerUserId: 'user_1',
          ownerName: 'Studio User',
          updatedAt: '2026-05-09T18:00:00.000Z',
          sceneCount: 3,
          widgetCount: 14,
          openCount: 12,
        },
      ],
      recentActivity: [
        {
          id: 'activity_1',
          workspaceId: 'ws_retail',
          workspaceName: 'Retail Group',
          projectId: 'proj_retail_1',
          projectName: 'Spring launch',
          actorUserId: 'user_1',
          actorName: 'Studio User',
          action: 'exported',
          createdAt: '2026-05-09T18:10:00.000Z',
        },
      ],
      contributorLeaderboard: [
        {
          actorUserId: 'user_1',
          actorName: 'Studio User',
          projectCount: 5,
          openCount: 18,
          saveCount: 13,
          versionSaveCount: 7,
          exportCount: 4,
          shareCount: 1,
        },
      ],
      clientLeaderboard: [
        {
          workspaceId: 'ws_retail',
          workspaceName: 'Retail Group',
          projectCount: 12,
          openCount: 41,
          saveCount: 28,
          versionSaveCount: 14,
          exportCount: 9,
          shareCount: 3,
        },
      ],
      efficiency: {
        totalOpenEvents: 41,
        totalSaveEvents: 28,
        totalVersionSaveEvents: 14,
        totalExportEvents: 9,
        totalShareEvents: 3,
        averageOpenToSaveMinutes: 18,
        averageOpenToExportMinutes: 32,
      },
    },
  },
  '/v1/brand-kits': {
    brandKits: [],
  },
};

const installedPages = new WeakSet<Page>();

export async function installMockServer(page: Page): Promise<void> {
  if (installedPages.has(page)) return;
  installedPages.add(page);
  await page.route('**/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/v1/auth/')) {
      await route.fulfill({
        status: 503,
        contentType: 'text/plain;charset=utf-8',
        body: 'platform-api-unavailable',
      });
      return;
    }
    const response = MOCK_RESPONSES[url.pathname];

    if (response !== undefined) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
      return;
    }

    await route.fulfill({
      status: 503,
      contentType: 'text/plain;charset=utf-8',
      body: 'mock-not-configured',
    });
  });
}
