import React from 'react';

type GlyphName =
  | 'impressions'
  | 'clicks'
  | 'ctr'
  | 'viewability'
  | 'video'
  | 'identity'
  | 'attention'
  | 'campaign'
  | 'tag'
  | 'creative'
  | 'geo'
  | 'tracker'
  | 'wallet'
  | 'settings'
  | 'search'
  | 'filter'
  | 'calendar'
  | 'share'
  | 'export'
  | 'spark'
  | 'dashboard'
  | 'health'
  | 'more'
  | 'chevron';

function baseProps(size: number) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: `h-[${size}px] w-[${size}px]`,
    'aria-hidden': true,
  };
}

export function IconGlyph({ name, size = 16, className = '' }: { name: GlyphName; size?: number; className?: string }) {
  const props = { ...baseProps(size), className: `${baseProps(size).className} ${className}`.trim() };
  switch (name) {
    case 'impressions':
      return <svg {...props}><path d="M4 12s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
    case 'clicks':
      return <svg {...props}><path d="m8 4 8 8" /><path d="m12 4 4 4-6 6-4-4Z" /><path d="M14 14 20 20" /></svg>;
    case 'ctr':
      return <svg {...props}><path d="M6 18 18 6" /><path d="M8 7h.01" /><path d="M16 17h.01" /><circle cx="8" cy="7" r="2" /><circle cx="16" cy="17" r="2" /></svg>;
    case 'viewability':
      return <svg {...props}><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" /><circle cx="12" cy="12" r="3" /></svg>;
    case 'video':
      return <svg {...props}><rect x="4" y="5" width="12" height="14" rx="2" /><path d="m11 10 4 2-4 2v-4Z" /><path d="m18 9 2-1v8l-2-1" /></svg>;
    case 'identity':
      return <svg {...props}><circle cx="12" cy="8" r="3" /><path d="M5 19c1.8-3 4.2-4.5 7-4.5S17.2 16 19 19" /></svg>;
    case 'attention':
      return <svg {...props}><path d="M12 3v4" /><path d="M12 17v4" /><path d="M4.9 4.9 7.7 7.7" /><path d="m16.3 16.3 2.8 2.8" /><path d="M3 12h4" /><path d="M17 12h4" /><circle cx="12" cy="12" r="3.5" /></svg>;
    case 'campaign':
      return <svg {...props}><path d="M6 19V9M12 19V5M18 19v-7" /><path d="M4 19h16" /></svg>;
    case 'tag':
      return <svg {...props}><path d="M4 5h7l9 9-7 7-9-9V5Z" /><circle cx="8" cy="9" r="1.2" fill="currentColor" stroke="none" /></svg>;
    case 'creative':
      return <svg {...props}><rect x="4" y="5" width="16" height="14" rx="2" /><path d="m7 15 3-3 3 3 2-2 3 3" /><circle cx="15.5" cy="9.5" r="1.2" fill="currentColor" stroke="none" /></svg>;
    case 'geo':
      return <svg {...props}><path d="M12 21s6-4.8 6-10a6 6 0 1 0-12 0c0 5.2 6 10 6 10Z" /><circle cx="12" cy="11" r="2.5" /></svg>;
    case 'tracker':
      return <svg {...props}><path d="M4 12h16" /><path d="M12 4v16" /><circle cx="12" cy="12" r="7" /></svg>;
    case 'wallet':
      return <svg {...props}><path d="M4 8h13a3 3 0 0 1 3 3v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" /><path d="M4 8V7a2 2 0 0 1 2-2h10" /><path d="M16 13h4" /></svg>;
    case 'settings':
      return <svg {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .7.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.7Z" /></svg>;
    case 'search':
      return <svg {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
    case 'filter':
      return <svg {...props}><path d="M4 6h16M7 12h10M10 18h4" /></svg>;
    case 'calendar':
      return <svg {...props}><rect x="4" y="6" width="16" height="14" rx="2" /><path d="M8 4v4M16 4v4M4 10h16" /></svg>;
    case 'share':
      return <svg {...props}><path d="M8 12 16 7" /><path d="m8 12 8 5" /><circle cx="6" cy="12" r="2" /><circle cx="18" cy="7" r="2" /><circle cx="18" cy="17" r="2" /></svg>;
    case 'export':
      return <svg {...props}><path d="M12 4v10" /><path d="m8 10 4 4 4-4" /><path d="M4 18h16" /></svg>;
    case 'spark':
      return <svg {...props}><path d="m4 16 4-5 4 3 4-7 4 4" /></svg>;
    case 'dashboard':
      return <svg {...props}><path d="M4 15a8 8 0 1 1 16 0" /><path d="m12 15 4-5" /><path d="M8 19h8" /></svg>;
    case 'health':
      return <svg {...props}><path d="M12 21c-4.5-2.6-7.5-6.4-7.5-10.6A4.4 4.4 0 0 1 8.9 6c1.4 0 2.6.6 3.1 1.6.5-1 1.7-1.6 3.1-1.6a4.4 4.4 0 0 1 4.4 4.4C19.5 14.6 16.5 18.4 12 21Z" /></svg>;
    case 'more':
      return <svg {...props}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></svg>;
    case 'chevron':
      return <svg {...props}><path d="m9 6 6 6-6 6" /></svg>;
    default:
      return null;
  }
}
