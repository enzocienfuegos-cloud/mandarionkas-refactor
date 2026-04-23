ALTER TABLE tag_format_configs
  ADD COLUMN IF NOT EXISTS tracker_type TEXT CHECK (tracker_type IN ('click', 'impression'));
