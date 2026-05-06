import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider, ConfirmProvider, CommandPaletteProvider, CenteredSpinner } from './system';
import Shell from './shell/Shell';
import Register from './auth/Register';

const Login = lazy(() => import('./pages-refactored/Login'));
const Launcher = lazy(() => import('./pages-refactored/Launcher'));

const Overview = lazy(() => import('./pages-refactored/AdOpsOverview'));
const CampaignList = lazy(() => import('./pages-refactored/CampaignList'));
const CampaignEditor = lazy(() => import('./pages-refactored/CampaignEditor'));
const TagList = lazy(() => import('./pages-refactored/TagList'));
const TagBuilder = lazy(() => import('./pages-refactored/TagBuilder'));
const CreativeLibrary = lazy(() => import('./pages-refactored/creative-library/CreativeLibrary'));
const CreativeApproval = lazy(() => import('./pages-refactored/CreativeApproval'));
const PacingDashboard = lazy(() => import('./pages-refactored/PacingDashboard'));
const Discrepancies = lazy(() => import('./pages-refactored/DiscrepancyDashboard'));
const Reporting = lazy(() => import('./analytics/AnalyticsDashboard'));
const AbExperimentEditor = lazy(() => import('./pages-refactored/AbExperimentEditor'));
const Experiments = lazy(() => import('./pages-refactored/Experiments'));
const Settings = lazy(() => import('./pages-refactored/Settings'));
const Clients = lazy(() => import('./pages-refactored/Clients'));
const Tools = lazy(() => import('./pages-refactored/Tools'));
const TagValidator = lazy(() => import('./pages-refactored/tools/TagValidator'));
const MacroBuilder = lazy(() => import('./pages-refactored/tools/MacroBuilder'));
const WebhookTester = lazy(() => import('./pages-refactored/tools/WebhookTester'));
const NotFound = lazy(() => import('./pages-refactored/NotFound'));
const DesignShowcase = lazy(() => import('./pages-refactored/DesignShowcase'));

const TagBindingDashboard = lazy(() => import('./tags/TagBindingDashboard'));
const TagHealthDashboard = lazy(() => import('./tags/TagHealthDashboard'));
const TagPixelsManager = lazy(() => import('./tags/TagPixelsManager'));
const TagTrackingDashboard = lazy(() => import('./tags/TagTrackingDashboard'));
const TagReportingDashboard = lazy(() => import('./reporting/TagReportingDashboard'));
const CreativeUpload = lazy(() => import('./creatives/CreativeUpload'));
const GlobalSearch = lazy(() => import('./search/GlobalSearch'));
const VastValidator = lazy(() => import('./vast/VastValidator'));
const VastChainValidator = lazy(() => import('./vast/VastChainValidator'));

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <CommandPaletteProvider>
          <BrowserRouter>
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
                  <Route path="/tags/new" element={<TagBuilder />} />
                  <Route path="/tags/:id" element={<TagBuilder />} />
                  <Route path="/tags/:id/health" element={<TagHealthDashboard />} />
                  <Route path="/tags/:id/pixels" element={<TagPixelsManager />} />
                  <Route path="/tags/:id/tracking" element={<TagTrackingDashboard />} />
                  <Route path="/tags/:id/reporting" element={<TagReportingDashboard />} />

                  <Route path="/creatives" element={<CreativeLibrary />} />
                  <Route path="/creatives/approval" element={<CreativeApproval />} />
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
          </BrowserRouter>
        </CommandPaletteProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
