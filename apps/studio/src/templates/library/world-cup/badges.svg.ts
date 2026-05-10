export function buildWorldCupTokenImage(label: string, accent: string, secondary: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="156" height="180" viewBox="0 0 156 180">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${secondary}" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
      </defs>
      <rect x="16" y="12" width="124" height="156" rx="22" fill="url(#bg)" />
      <rect x="24" y="20" width="108" height="140" rx="18" fill="rgba(8,15,28,.26)" stroke="rgba(255,255,255,.28)" stroke-width="2" />
      <circle cx="78" cy="58" r="16" fill="rgba(255,255,255,.92)" />
      <rect x="40" y="90" width="76" height="12" rx="6" fill="rgba(255,255,255,.96)" />
      <rect x="48" y="110" width="60" height="10" rx="5" fill="rgba(255,255,255,.76)" />
      <rect x="34" y="130" width="88" height="18" rx="9" fill="rgba(8,15,28,.34)" />
      <text x="78" y="143" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#ffffff">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
