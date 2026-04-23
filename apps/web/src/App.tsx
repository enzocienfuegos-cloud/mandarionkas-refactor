import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Shell   from './shell/Shell';
import Login    from './auth/Login';
import Register from './auth/Register';

const CampaignList       = lazy(() => import('./campaigns/CampaignList'));
const CampaignEditor     = lazy(() => import('./campaigns/CampaignEditor'));
const AdOpsOverview      = lazy(() => import('./overview/AdOpsOverview'));
const ClientManager      = lazy(() => import('./clients/ClientManager'));
const TagList            = lazy(() => import('./tags/TagList'));
const TagBuilder         = lazy(() => import('./tags/TagBuilder'));
const TagBindingDashboard = lazy(() => import('./tags/TagBindingDashboard'));
const TagHealthDashboard = lazy(() => import('./tags/TagHealthDashboard'));
const TagReportingDashboard = lazy(() => import('./reporting/TagReportingDashboard'));
const CreativeLibrary    = lazy(() => import('./creatives/CreativeLibrary'));
const CreativeApproval   = lazy(() => import('./creatives/CreativeApproval'));
const CreativeUpload     = lazy(() => import('./creatives/CreativeUpload'));
const AnalyticsDashboard = lazy(() => import('./analytics/AnalyticsDashboard'));
const PacingDashboard    = lazy(() => import('./pacing/PacingDashboard'));
const DiscrepancyDashboard = lazy(() => import('./discrepancies/DiscrepancyDashboard'));
const AbExperimentEditor = lazy(() => import('./ab-testing/AbExperimentEditor'));
const GlobalSearch       = lazy(() => import('./search/GlobalSearch'));
const ApiKeys            = lazy(() => import('./api-keys/ApiKeys'));
const AuditLog           = lazy(() => import('./audit/AuditLog'));
const WorkspaceSettings  = lazy(() => import('./team/WorkspaceSettings'));
const WebhookManager     = lazy(() => import('./webhooks/WebhookManager'));
const VastValidator      = lazy(() => import('./vast/VastValidator'));
const VastChainValidator = lazy(() => import('./vast/VastChainValidator'));
const ToolsHome         = lazy(() => import('./tools/ToolsHome'));
const SettingsHome      = lazy(() => import('./settings/SettingsHome'));

const Spinner = () => (
  <div className="flex h-full items-center justify-center">
    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500" />
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Spinner />}>
        <Routes>
          {/* Public */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected — Shell provides sidebar + topbar via Outlet */}
          <Route path="/" element={<Shell />}>
            <Route index element={<Navigate to="/overview" replace />} />

            {/* Overview */}
            <Route path="overview" element={<AdOpsOverview />} />

            {/* Campaigns */}
            <Route path="campaigns"        element={<CampaignList />} />
            <Route path="campaigns/new"    element={<CampaignEditor />} />
            <Route path="campaigns/:id"    element={<CampaignEditor />} />

            {/* Clients */}
            <Route path="clients"          element={<ClientManager />} />

            {/* Tags */}
            <Route path="tags"                      element={<TagList />} />
            <Route path="tags/bindings"             element={<TagBindingDashboard />} />
            <Route path="tags/new"                  element={<Navigate to="/tags?create=1" replace />} />
            <Route path="tags/:id"                  element={<TagBuilder />} />
            <Route path="tags/:id/health"           element={<TagHealthDashboard />} />
            <Route path="tags/:id/reporting"        element={<TagReportingDashboard />} />

            {/* Creatives */}
            <Route path="creatives"          element={<CreativeLibrary />} />
            <Route path="creatives/approval" element={<CreativeApproval />} />
            <Route path="creatives/upload"   element={<CreativeUpload />} />

            {/* Analytics */}
            <Route path="reporting"      element={<TagReportingDashboard />} />
            <Route path="analytics"      element={<AnalyticsDashboard />} />
            <Route path="pacing"         element={<PacingDashboard />} />
            <Route path="discrepancies"  element={<DiscrepancyDashboard />} />
            <Route path="experiments"    element={<AbExperimentEditor />} />

            {/* Tools */}
            <Route path="tools"                 element={<ToolsHome />} />
            <Route path="tools/vast-validator"  element={<VastValidator />} />
            <Route path="tools/chain-validator" element={<VastChainValidator />} />

            {/* Search */}
            <Route path="search" element={<GlobalSearch />} />

            {/* Settings */}
            <Route path="settings"            element={<SettingsHome />} />
            <Route path="settings/api-keys"   element={<ApiKeys />} />
            <Route path="settings/audit-log"  element={<AuditLog />} />
            <Route path="settings/workspace"  element={<WorkspaceSettings />} />
            <Route path="settings/webhooks"   element={<WebhookManager />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
