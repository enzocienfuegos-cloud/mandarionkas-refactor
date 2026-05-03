// Shared UA parsing utilities — single source of truth.

export function parseDeviceTypeFromUA(ua) {
  if (!ua) return '';
  const s = ua.toLowerCase();
  if (/smart.?tv|hbbtv|appletv|googletv|roku|firetv|tizen|webos|viera|bravia/.test(s)) return 'tv';
  if (/tablet|ipad|kindle|playbook|silk/.test(s)) return 'tablet';
  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry|symbian/.test(s)) return 'phone';
  if (/android/.test(s)) return 'tablet';
  return 'desktop';
}

export function parseBrowserFromUA(ua) {
  if (!ua) return '';
  const s = ua.toLowerCase();
  if (/edg\/|edge\//.test(s)) return 'Edge';
  if (/opr\/|opera\//.test(s)) return 'Opera';
  if (/firefox\//.test(s)) return 'Firefox';
  if (/chrome\//.test(s)) return 'Chrome';
  if (/safari\//.test(s)) return 'Safari';
  if (/msie |trident\//.test(s)) return 'IE';
  return '';
}

export function parseOsFromUA(ua) {
  if (!ua) return '';
  const s = ua.toLowerCase();
  if (/windows phone/.test(s)) return 'Windows Phone';
  if (/windows/.test(s)) return 'Windows';
  if (/iphone|ipad|ipod|ios/.test(s)) return 'iOS';
  if (/mac os x|macos/.test(s)) return 'macOS';
  if (/android/.test(s)) return 'Android';
  if (/linux/.test(s)) return 'Linux';
  if (/cros/.test(s)) return 'ChromeOS';
  return '';
}
