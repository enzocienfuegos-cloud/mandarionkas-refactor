const DEFAULT_PREFERENCES = {
  theme: 'dark',
  sidebarCollapsed: false,
  densityByTable: {},
  metricStripByScope: {},
};

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

function normalizePreferences(input = {}) {
  return {
    theme: sanitizeTheme(input.theme),
    sidebarCollapsed: Boolean(input.sidebarCollapsed),
    densityByTable: sanitizeDensityMap(input.densityByTable),
    metricStripByScope: sanitizeMetricStripMap(input.metricStripByScope),
  };
}

function mergePreferences(base, patch) {
  return {
    ...base,
    ...patch,
    densityByTable: {
      ...(base.densityByTable ?? {}),
      ...(patch.densityByTable ?? {}),
    },
    metricStripByScope: {
      ...(base.metricStripByScope ?? {}),
      ...(patch.metricStripByScope ?? {}),
    },
  };
}

export async function getUserPreferences(client, userId) {
  const { rows } = await client.query(
    `select key, value_json
       from user_preferences
      where user_id = $1`,
    [userId],
  );

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
  const current = await getUserPreferences(client, userId);
  const merged = mergePreferences(current, normalizePreferences(mergePreferences(current, patch)));

  const entries = [
    ['theme', { value: merged.theme }],
    ['sidebarCollapsed', { value: merged.sidebarCollapsed }],
    ['densityByTable', merged.densityByTable],
    ['metricStripByScope', merged.metricStripByScope],
  ];

  for (const [key, value] of entries) {
    await client.query(
      `insert into user_preferences (user_id, key, value_json, updated_at)
       values ($1, $2, $3::jsonb, now())
       on conflict (user_id, key)
       do update set value_json = excluded.value_json, updated_at = now()`,
      [userId, key, JSON.stringify(value)],
    );
  }

  return merged;
}
