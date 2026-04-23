import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  completeCreativeIngestion,
  createCreativeIngestionUpload,
  publishCreativeIngestion,
  uploadFileToSignedUrl,
} from './catalog';
import { createClientWorkspace, loadAuthMe, loadWorkspaces, switchWorkspace, type WorkspaceOption } from '../shared/workspaces';

type SourceKind = 'html5_zip' | 'video_mp4';

const ACCEPTED_EXTENSIONS: Record<SourceKind, string> = {
  html5_zip: '.zip',
  video_mp4: '.mp4',
};

export default function CreativeUpload() {
  const navigate = useNavigate();
  const [sourceKind, setSourceKind] = useState<SourceKind>('html5_zip');
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [workspaceBusy, setWorkspaceBusy] = useState(false);

  useEffect(() => {
    Promise.all([loadAuthMe(), loadWorkspaces()])
      .then(([authMe, workspaceList]) => {
        setWorkspaces(workspaceList);
        setWorkspaceId(authMe.workspace?.id ?? workspaceList[0]?.id ?? '');
      })
      .catch(() => {});
  }, []);

  const handleWorkspaceChange = async (nextWorkspaceId: string) => {
    if (!nextWorkspaceId || nextWorkspaceId === workspaceId) {
      setWorkspaceId(nextWorkspaceId);
      return;
    }
    setWorkspaceBusy(true);
    setError('');
    try {
      await switchWorkspace(nextWorkspaceId);
      setWorkspaceId(nextWorkspaceId);
    } catch (workspaceError: any) {
      setError(workspaceError.message ?? 'Failed to switch client');
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const handleCreateClient = async () => {
    const clientName = window.prompt('New client name');
    if (!clientName?.trim()) return;
    setWorkspaceBusy(true);
    setError('');
    try {
      const response = await createClientWorkspace(clientName.trim());
      const workspaceList = await loadWorkspaces();
      setWorkspaces(workspaceList);
      setWorkspaceId(response.activeWorkspaceId ?? response.client?.id ?? workspaceList[0]?.id ?? '');
    } catch (workspaceError: any) {
      setError(workspaceError.message ?? 'Failed to create client');
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError('Select a file first.');
      return;
    }
    if (!workspaceId) {
      setError('Select a client before uploading.');
      return;
    }

    setLoading(true);
    setError('');
    setStatus('Preparing upload…');

    try {
      await handleWorkspaceChange(workspaceId);
      const upload = await createCreativeIngestionUpload({ sourceKind, file, name: name.trim() || undefined });
      setStatus('Uploading file…');
      await uploadFileToSignedUrl(upload.upload.uploadUrl, file);

      setStatus('Validating ingestion…');
      await completeCreativeIngestion(upload.ingestion.id, {
        file,
        publicUrl: upload.upload.publicUrl,
        storageKey: upload.upload.storageKey,
        name: name.trim() || undefined,
      });

      setStatus('Publishing to creative catalog…');
      await publishCreativeIngestion(upload.ingestion.id, {
        name: name.trim() || undefined,
      });

      setStatus('Creative published.');
      navigate('/creatives');
    } catch (submitError: any) {
      setError(submitError.message ?? 'Upload failed');
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Upload External Creative</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload an HTML5 zip or MP4 and publish it into the versioned creative catalog.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Client</label>
            <div className="mb-4 flex items-center gap-2">
              <select
                value={workspaceId}
                onChange={event => void handleWorkspaceChange(event.target.value)}
                disabled={loading || workspaceBusy}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a client</option>
                {workspaces.map(workspace => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleCreateClient()}
                disabled={loading || workspaceBusy}
                className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                New client
              </button>
            </div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Source Type</label>
            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => setSourceKind('html5_zip')}
                className={`rounded-xl border px-4 py-3 text-left ${sourceKind === 'html5_zip' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <div className="font-medium text-slate-800">HTML5 ZIP</div>
                <div className="text-sm text-slate-500">Publishes `index.html` and all packaged assets to hosted display creative artifacts.</div>
              </button>
              <button
                type="button"
                onClick={() => setSourceKind('video_mp4')}
                className={`rounded-xl border px-4 py-3 text-left ${sourceKind === 'video_mp4' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <div className="font-medium text-slate-800">Video MP4</div>
                <div className="text-sm text-slate-500">Creates a video creative version ready for VAST serving and review.</div>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Display Name</label>
              <input
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="Spring launch takeover"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Creative File</label>
              <input
                key={sourceKind}
                type="file"
                accept={ACCEPTED_EXTENSIONS[sourceKind]}
                onChange={event => setFile(event.target.files?.[0] ?? null)}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
              />
              <p className="mt-2 text-xs text-slate-500">
                Accepted: {ACCEPTED_EXTENSIONS[sourceKind]} · the backend will validate and publish the artifact.
              </p>
            </div>
          </div>
        </div>

        {status && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {status}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/creatives')}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-400"
          >
            {loading ? 'Uploading…' : 'Upload and Publish'}
          </button>
        </div>
      </form>
    </div>
  );
}
