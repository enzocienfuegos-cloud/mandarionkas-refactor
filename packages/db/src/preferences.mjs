const DEFAULT_PREFERENCES = {
  theme: 'dark',
  sidebarCollapsed: false,
  densityByTable: {},
  metricStripByScope: {},
};

function isMissingPreferencesTable(error) {
  return error?.code === '42P01' && /user_preferences/i.test(String(error?.message ?? ''));
}

function sanitizeDensityMap(input) {
  const next = {};
  const value = input && typeof input === 'object' ? input : {};
  for (const [key, density] of Object.entries(value)) {
    if (['compact', 'comfortable', 'spacious'].includes(String(density))) {
      next[key] = density;
    }
  }
  return next;
}

function sanitizeMetricStripMap(input) {
  const next = {};
  const value = input && typeof input === 'object' ? input : {};
  for (const [scope, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== 'object') continue;
    const selectedIds = Array.isArray(entry.selectedIds)
      ? [...new Set(entry.selectedIds.map((item) => String(item || '').trim()).filter(Boolean))]
      : [];
    next[scope] = { selectedIds };
  }
  return next;
}

function sanitizeTheme(value) {
  return value === 'light' ? 'light' : 'dark';
}

export async function getUserPreferences(client, userId) {
  let rows = [];
  try {
    const result = await client.query(
      `select key, value_json
         from user_preferences
        where user_id = $1`,
      [userId],
    );
    rows = result.rows;
  } catch (error) {
    if (!isMissingPreferencesTable(error)) throw error;
    return { ...DEFAULT_PREFERENCES };
  }

  const collected = { ...DEFAULT_PREFERENCES };
  for (const row of rows) {
    const key = String(row.key || '').trim();
    const value = row.value_json ?? {};
    if (key === 'theme') {
      collected.theme = sanitizeTheme(value?.value);
    } else if (key === 'sidebarCollapsed') {
      collected.sidebarCollapsed = Boolean(value?.value);
    } else if (key === 'densityByTable') {
      collected.densityByTable = sanitizeDensityMap(value);
    } else if (key === 'metricStripByScope') {
      collected.metricStripByScope = sanitizeMetricStripMap(value);
    }
  }

  return collected;
}

export async function saveUserPreferences(client, userId, patch = {}) {
  const sanitized = {};

  if (patch.theme !== undefined) {
    sanitized.theme = sanitizeTheme(patch.theme);
  }
  if (patch.sidebarCollapsed !== undefined) {
    sanitized.sidebarCollapsed = Boolean(patch.sidebarCollapsed);
  }
  if (patch.densityByTable !== undefined) {
    sanitized.densityByTable = sanitizeDensityMap(patch.densityByTable);
  }
  if (patch.metricStripByScope !== undefined) {
    sanitized.metricStripByScope = sanitizeMetricStripMap(patch.metricStripByScope);
  }

  const writes = [];
  if ('theme' in sanitized) writes.push(['theme', { value: sanitized.theme }]);
  if ('sidebarCollapsed' in sanitized) writes.push(['sidebarCollapsed', { value: sanitized.sidebarCollapsed }]);
  if ('densityByTable' in sanitized) writes.push(['densityByTable', sanitized.densityByTable]);
  if ('metricStripByScope' in sanitized) writes.push(['metricStripByScope', sanitized.metricStripByScope]);

  try {
    for (const [key, value] of writes) {
      await client.query(
        `insert into user_preferences (user_id, key, value_json, updated_at)
         values ($1, $2, $3::jsonb, now())
         on conflict (user_id, key)
         do update set value_json = excluded.value_json, updated_at = now()`,
        [userId, key, JSON.stringify(value)],
      );
    }
  } catch (error) {
    if (!isMissingPreferencesTable(error)) throw error;
    return {
      ...DEFAULT_PREFERENCES,
      ...('theme' in sanitized ? { theme: sanitized.theme } : {}),
      ...('sidebarCollapsed' in sanitized ? { sidebarCollapsed: sanitized.sidebarCollapsed } : {}),
      ...('densityByTable' in sanitized ? { densityByTable: sanitized.densityByTable } : {}),
      ...('metricStripByScope' in sanitized ? { metricStripByScope: sanitized.metricStripByScope } : {}),
    };
  }

  return getUserPreferences(client, userId);
}
