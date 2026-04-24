ALTER TABLE workspace_members
ADD COLUMN IF NOT EXISTS product_access JSONB NOT NULL DEFAULT '{"ad_server": true, "studio": true}'::jsonb;

UPDATE workspace_members
SET product_access = COALESCE(product_access, '{"ad_server": true, "studio": true}'::jsonb)
WHERE product_access IS NULL;
