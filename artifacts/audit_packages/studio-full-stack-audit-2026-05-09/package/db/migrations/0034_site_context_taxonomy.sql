-- Migration 0034: site context taxonomy (IAB classification)

CREATE TABLE IF NOT EXISTS site_context_taxonomy (
  domain TEXT PRIMARY KEY,
  iab_category TEXT,
  context_type TEXT NOT NULL,
  language CHAR(2),
  notes TEXT
);

INSERT INTO site_context_taxonomy (domain, iab_category, context_type, language) VALUES
  ('elsalvador.com', 'IAB12', 'news', 'es'),
  ('laprensagrafica.com', 'IAB12', 'news', 'es'),
  ('diarioelmundo.com', 'IAB12', 'news', 'es'),
  ('elsalvadortimes.com', 'IAB12', 'news', 'es'),
  ('deportes.com.sv', 'IAB17', 'sports', 'es'),
  ('youtube.com', 'IAB1', 'entertainment', 'es'),
  ('spotify.com', 'IAB1', 'entertainment', 'es'),
  ('grupo-bac.com', 'IAB13', 'finance', 'es'),
  ('bancoagricola.com', 'IAB13', 'finance', 'es')
ON CONFLICT (domain) DO NOTHING;
