import { useEffect, useState } from 'react';
import {
  loadCreativesWithLatestVersion,
  loadCreativeIngestions,
  loadTags,
  type Creative,
  type CreativeIngestion,
  type TagOption,
} from '../catalog';
import { loadAuthMe, loadWorkspaces, type WorkspaceOption } from '../../shared/workspaces';
import type { LatestVersionMap } from './types';
import { buildLatestVersionPatch } from './utils';

export function useCreativeCatalogData() {
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [latestVersions, setLatestVersions] = useState<LatestVersionMap>({});
  const [ingestions, setIngestions] = useState<CreativeIngestion[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [{ creatives, latestVersions }, ingestions, tags, authMe, workspaceList] = await Promise.all([
        loadCreativesWithLatestVersion({ scope: 'all' }),
        loadCreativeIngestions(),
        loadTags({ scope: 'all' }),
        loadAuthMe(),
        loadWorkspaces(),
      ]);
      setCreatives(creatives);
      setLatestVersions(latestVersions);
      setIngestions(ingestions);
      setTags(tags);
      setWorkspaces(workspaceList);
      setActiveWorkspaceId(authMe.workspace?.id ?? workspaceList[0]?.id ?? '');
    } catch (loadError: any) {
      setError(loadError.message ?? 'Failed to load creative catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const hasProcessing = creatives.some((creative) => {
      const version = latestVersions[creative.id];
      return version?.sourceKind === 'html5_zip' && String(version?.status ?? '') === 'processing';
    });
    if (!hasProcessing) return undefined;

    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const { latestVersions: nextVersions } = await loadCreativesWithLatestVersion({ scope: 'all' });
          setLatestVersions((current) => {
            const patch = buildLatestVersionPatch(current, nextVersions);
            return Object.keys(patch).length > 0 ? { ...current, ...patch } : current;
          });
        } catch (_) {}
      })();
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [creatives, latestVersions]);

  return {
    creatives,
    setCreatives,
    latestVersions,
    setLatestVersions,
    ingestions,
    setIngestions,
    tags,
    setTags,
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    loading,
    error,
    setError,
    load,
  };
}
