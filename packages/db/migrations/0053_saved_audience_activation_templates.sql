ALTER TABLE saved_audiences
  ADD COLUMN IF NOT EXISTS activation_template TEXT NOT NULL DEFAULT 'full';

CREATE INDEX IF NOT EXISTS saved_audiences_activation_template_idx
  ON saved_audiences(activation_template);
