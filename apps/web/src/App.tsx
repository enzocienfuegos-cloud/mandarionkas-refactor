import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastProvider, ConfirmProvider, CommandPaletteProvider, CenteredSpinner } from './system';
import Shell from './shell/Shell';
import Register from './auth/Register';

const Login = lazy(() => import('./auth/Login'));
const Launcher = lazy(() => import('./shell/ProductLauncher'));

const Overview = lazy(() => import('./overview/AdOpsOverview'));
const CampaignList = lazy(() => import('./campaigns/CampaignList'));
const CampaignEditor = lazy(() => import('./campaigns/CampaignEditor'));
const TagList = lazy(() => import('./tags/TagList'));
const TagBuilder = lazy(() => import('./tags/TagBuilder'));
const CreativeLibrary = lazy(() => import('./creatives/CreativeLibrary'));
const PacingDashboard = lazy(() => import('./pacing/PacingDashboard'));
const Discrepancies = lazy(() => import('./discrepancies/DiscrepancyDashboard'));
const Reporting = lazy(() => import('./features/reporting/ReportingPage').then((module) => ({ default: module.ReportingPage })));
const AbExperimentEditor = lazy(() => import('./ab-testing/AbExperimentEditor'));
const Experiments = lazy(() => import('./experiments/Experiments'));
const Settings = lazy(() => import('./settings/Settings'));
const Clients = lazy(() => import('./clients/Clients'));
const Tools = lazy(() => import('./tools/Tools'));
const TagValidator = lazy(() => import('./tools/TagValidator'));
const MacroBuilder = lazy(() => import('./tools/MacroBuilder'));
const WebhookTester = lazy(() => import('./tools/WebhookTester'));
const NotFound = lazy(() => import('./not-found/NotFound'));
const DesignShowcase = lazy(() => import('./showcase/DesignShowcase'));

const TagBindingDashboard = lazy(() => import('./tags/TagBindingDashboard'));
const TagHealthDashboard = lazy(() => import('./tags/TagHealthDashboard'));
const TagPixelsManager = lazy(() => import('./tags/TagPixelsManager'));
const TagTrackingDashboard = lazy(() => import('./tags/TagTrackingDashboard'));
const TagReportingDashboard = lazy(() => import('./reporting/TagReportingDashboard'));
const CreativeUpload = lazy(() => import('./creatives/CreativeUpload'));
const GlobalSearch = lazy(() => import('./search/GlobalSearch'));
const VastValidator = lazy(() => import('./vast/VastValidator'));
const VastChainValidator = lazy(() => import('./vast/VastChainValidator'));

function resolveCommandPaletteContext(pathname: string): { entity: string; id?: string } | undefined {
  if (pathname.startsWith('/campaigns')) return { entity: 'campaign' };
  if (pathname.startsWith('/tags')) {
    const match = pathname.match(/^\/tags\/([^/]+)/);
    return match ? { entity: 'tag', id: match[1] } : { entity: 'tag' };
  }
  if (pathname.startsWith('/creatives')) return { entity: 'creative' };
  if (pathname.startsWith('/settings')) return { entity: 'settings' };
  if (pathname.startsWith('/tools')) return { entity: 'tools' };
  if (pathname.startsWith('/reporting') || pathname.startsWith('/analytics')) return { entity: 'reporting' };
  if (pathname.startsWith('/overview')) return { entity: 'overview' };
  return undefined;
}

function RouteAwareCommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const context = React.useMemo(
    () => resolveCommandPaletteContext(location.pathname),
    [location.pathname],
  );

  return (
    <CommandPaletteProvider context={context}>
      {children}
    </CommandPaletteProvider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
          <BrowserRouter>
            <RouteAwareCommandPaletteProvider>
            <Suspense fallback={<CenteredSpinner label="Loading…" />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/launch" element={<Launcher />} />

                <Route element={<Shell />}>
                  <Route index element={<Navigate to="/overview" replace />} />

                  <Route path="/overview" element={<Overview />} />

                  <Route path="/campaigns" element={<CampaignList />} />
                  <Route path="/campaigns/new" element={<CampaignEditor />} />
                  <Route path="/campaigns/:id" element={<CampaignEditor />} />

                  <Route path="/tags" element={<TagList />} />
                  <Route path="/tags/bindings" element={<TagBindingDashboard />} />
                  <Route path="/tags/health" element={<TagHealthDashboard />} />
                  <Route path="/tags/new" element={<TagBuilder />} />
                  <Route path="/tags/:id" element={<TagBuilder />} />
                  <Route path="/tags/:id/health" element={<Navigate to="/tags/health" replace />} />
                  <Route path="/tags/:id/pixels" element={<TagPixelsManager />} />
                  <Route path="/tags/:id/tracking" element={<TagTrackingDashboard />} />
                  <Route path="/tags/:id/reporting" element={<TagReportingDashboard />} />

                  <Route path="/creatives" element={<CreativeLibrary />} />
                  <Route path="/creatives/upload" element={<CreativeUpload />} />

                  <Route path="/pacing" element={<PacingDashboard />} />
                  <Route path="/discrepancies" element={<Discrepancies />} />
                  <Route path="/reporting" element={<Reporting />} />
                  <Route path="/analytics" element={<Reporting />} />

                  <Route path="/experiments" element={<Experiments />} />
                  <Route path="/experiments/new" element={<AbExperimentEditor />} />
                  <Route path="/experiments/:id" element={<AbExperimentEditor />} />

                  <Route path="/clients" element={<Clients />} />
                  <Route path="/tools" element={<Tools />} />
                  <Route path="/tools/tag-validator" element={<TagValidator />} />
                  <Route path="/tools/macro-builder" element={<MacroBuilder />} />
                  <Route path="/tools/webhook-tester" element={<WebhookTester />} />
                  <Route path="/tools/vast-validator" element={<VastValidator />} />
                  <Route path="/tools/chain-validator" element={<VastChainValidator />} />

                  <Route path="/search" element={<GlobalSearch />} />

                  {/* All /settings/* routes are owned by the Settings shell.
                      It dispatches internally to ApiKeys, AuditLog,
                      WorkspaceSettings, WebhookManager based on the URL. */}
                  <Route path="/settings" element={<Navigate to="/settings/profile" replace />} />
                  <Route path="/settings/*" element={<Settings />} />

                  <Route path="/design-system" element={<DesignShowcase />} />
                  <Route path="*" element={<NotFound />} />
                </Route>

                <Route path="*" element={<Navigate to="/overview" replace />} />
              </Routes>
            </Suspense>
            </RouteAwareCommandPaletteProvider>
          </BrowserRouter>
      </ConfirmProvider>
    </ToastProvider>
  );
}
