const KEYWORD_RULES = [
  { type: 'sports', tokens: ['deporte', 'sport', 'futbol', 'football', 'nfl', 'nba', 'liga', 'atletismo', 'basket', 'tenis', 'golf', 'beisbol', 'baseball', 'racing', 'f1', 'moto', 'olimpic'] },
  { type: 'news', tokens: ['noticias', 'news', 'prensa', 'periodico', 'diario', 'informacion', 'actualidad', 'novedades', 'titular'] },
  { type: 'entertainment', tokens: ['entretenimiento', 'musica', 'music', 'pelicula', 'movie', 'serie', 'tv', 'television', 'show', 'juego', 'game', 'humor', 'comedia'] },
  { type: 'finance', tokens: ['finanza', 'finance', 'bolsa', 'mercado', 'banco', 'inversion', 'economia', 'cripto', 'crypto', 'prestamo', 'credito'] },
  { type: 'tech', tokens: ['tecnologia', 'tech', 'software', 'hardware', 'android', 'iphone', 'gadget', 'programacion', 'startup', 'inteligencia'] },
  { type: 'lifestyle', tokens: ['moda', 'fashion', 'belleza', 'beauty', 'salud', 'health', 'viaje', 'travel', 'comida', 'food', 'receta', 'recipe', 'hogar', 'home'] },
];

function inferFromUrl(url) {
  if (!url) return null;
  const lower = url.toLowerCase();
  for (const rule of KEYWORD_RULES) {
    if (rule.tokens.some((token) => lower.includes(token))) return rule.type;
  }
  return null;
}

export async function inferContext(pool, { siteDomain, referer, appBundle, appName, contentGenre }) {
  if (contentGenre) {
    const g = contentGenre.toLowerCase();
    if (/sport|deport/.test(g)) return 'sports';
    if (/news|noticias/.test(g)) return 'news';
    if (/entertainment|entretenimiento/.test(g)) return 'entertainment';
    if (/finance|finanza/.test(g)) return 'finance';
  }

  if (siteDomain && pool) {
    try {
      const { rows } = await pool.query(
        'SELECT context_type FROM site_context_taxonomy WHERE domain = $1 LIMIT 1',
        [siteDomain],
      );
      if (rows[0]?.context_type) return rows[0].context_type;
    } catch (_) {
      // Best-effort fallback below.
    }
  }

  const fromRef = inferFromUrl(referer) || inferFromUrl(siteDomain);
  if (fromRef) return fromRef;

  if (appBundle || appName) return 'app';

  return 'unknown';
}
