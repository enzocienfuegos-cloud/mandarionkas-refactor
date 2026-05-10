import type { SidebarItemId } from './Sidebar';

export function getStudioUrl(): string {
  const configured = import.meta.env.VITE_STUDIO_URL?.trim();
  if (configured) return configured;
  if (import.meta.env.DEV) return 'http://localhost:5174';
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    if (hostname.startsWith('app-')) return `${protocol}//${hostname.replace(/^app-/, 'studio-')}`;
  }
  return '/';
}

export function resolveActiveItem(pathname: string): SidebarItemId {
  if (pathname.startsWith('/campaigns')) return 'campaigns';
  if (pathname.startsWith('/tags')) return 'tags';
  if (pathname.startsWith('/creatives')) return 'creatives';
  if (pathname.startsWith('/pacing')) return 'pacing';
  if (pathname.startsWith('/discrepancies')) return 'discrepancies';
  if (pathname.startsWith('/reporting') || pathname.startsWith('/analytics')) return 'reporting';
  if (pathname.startsWith('/experiments')) return 'experiments';
  if (pathname.startsWith('/clients')) return 'clients';
  if (pathname.startsWith('/tools')) return 'tools';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'overview';
}
