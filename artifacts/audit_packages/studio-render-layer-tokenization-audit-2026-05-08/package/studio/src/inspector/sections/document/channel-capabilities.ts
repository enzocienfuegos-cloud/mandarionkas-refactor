const FEED_CAPABLE_CHANNELS = new Set([
  'generic-html5',
  'google-display',
  'gam-html5',
]);

export function channelSupportsFeedCatalog(channel: string): boolean {
  return FEED_CAPABLE_CHANNELS.has(channel);
}
