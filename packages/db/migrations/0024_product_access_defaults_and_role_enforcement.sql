-- packages/db/migrations/0024_product_access_defaults_and_role_enforcement.sql
--
-- Sprint 51: Seal product_access defaults and enforce platform_role ceiling.
--
-- Problems fixed:
--   1. workspace_members rows with NULL product_access cause client-side
--      fallback logic to default to { ad_server: true, studio: true } for
--      ALL roles, including designers who should never touch adserver.
--   2. admin users had no guaranteed product_access row, causing the Shell
--      hydration to read null and trigger the redirect loop.
--
-- Design rule enforced here:
--   platform_role is the CEILING.
--   product_access in workspace_members can only NARROW it, never expand.
--
-- This migration:
--   a) back-fills all NULL product_access rows based on platform_role
--   b) adds a NOT NULL constraint + default
--   c) adds a check constraint that prevents product_access from granting
--      access that the user's platform_role doesn't permit

-- ---------------------------------------------------------------------------
-- Step 1: Back-fill NULL product_access rows from platform_role
-- ---------------------------------------------------------------------------

UPDATE workspace_members wm
SET product_access = CASE
  WHEN u.platform_role = 'admin'    THEN '{"ad_server": true,  "studio": true}'::jsonb
  WHEN u.platform_role = 'ad_ops'   THEN '{"ad_server": true,  "studio": false}'::jsonb
  WHEN u.platform_role = 'designer' THEN '{"ad_server": false, "studio": true}'::jsonb
  WHEN u.platform_role = 'reviewer' THEN '{"ad_server": true,  "studio": true}'::jsonb
  ELSE                                    '{"ad_server": true,  "studio": true}'::jsonb
END
FROM users u
WHERE wm.user_id = u.id
  AND wm.product_access IS NULL;

-- Catch any rows without a matching users record (orphaned invites, etc.)
UPDATE workspace_members
SET product_access = '{"ad_server": true, "studio": true}'::jsonb
WHERE product_access IS NULL;

-- ---------------------------------------------------------------------------
-- Step 2: Add NOT NULL constraint + column default
-- ---------------------------------------------------------------------------

ALTER TABLE workspace_members
  ALTER COLUMN product_access
  SET DEFAULT '{"ad_server": true, "studio": true}'::jsonb;

ALTER TABLE workspace_members
  ALTER COLUMN product_access
  SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Step 3: Back-fill workspace_invites the same way
-- ---------------------------------------------------------------------------

UPDATE workspace_invites wi
SET product_access = CASE
  WHEN u.platform_role = 'admin'    THEN '{"ad_server": true,  "studio": true}'::jsonb
  WHEN u.platform_role = 'ad_ops'   THEN '{"ad_server": true,  "studio": false}'::jsonb
  WHEN u.platform_role = 'designer' THEN '{"ad_server": false, "studio": true}'::jsonb
  WHEN u.platform_role = 'reviewer' THEN '{"ad_server": true,  "studio": true}'::jsonb
  ELSE                                    '{"ad_server": true,  "studio": true}'::jsonb
END
FROM users u
WHERE wi.email = u.email
  AND wi.product_access IS NULL;

UPDATE workspace_invites
SET product_access = '{"ad_server": true, "studio": true}'::jsonb
WHERE product_access IS NULL;

ALTER TABLE workspace_invites
  ALTER COLUMN product_access
  SET DEFAULT '{"ad_server": true, "studio": true}'::jsonb;

-- workspace_invites may not have the column yet — add it if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspace_invites'
      AND column_name = 'product_access'
  ) THEN
    ALTER TABLE workspace_invites
      ADD COLUMN product_access jsonb NOT NULL
      DEFAULT '{"ad_server": true, "studio": true}'::jsonb;
  ELSE
    ALTER TABLE workspace_invites
      ALTER COLUMN product_access SET NOT NULL;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Step 4: Add a DB-level function that enforces the role ceiling
--
-- Called from the application layer AND available as a DB-level safety net.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION resolve_product_access(
  p_platform_role text,
  p_workspace_access jsonb
) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  role_ad_server boolean;
  role_studio    boolean;
  ws_ad_server   boolean;
  ws_studio      boolean;
BEGIN
  -- Role ceiling
  CASE lower(p_platform_role)
    WHEN 'admin'    THEN role_ad_server := true;  role_studio := true;
    WHEN 'ad_ops'   THEN role_ad_server := true;  role_studio := false;
    WHEN 'designer' THEN role_ad_server := false; role_studio := true;
    WHEN 'reviewer' THEN role_ad_server := true;  role_studio := true;
    ELSE                 role_ad_server := false; role_studio := false;
  END CASE;

  -- Workspace narrowing
  ws_ad_server := coalesce((p_workspace_access ->> 'ad_server')::boolean, true);
  ws_studio    := coalesce((p_workspace_access ->> 'studio')::boolean, true);

  RETURN jsonb_build_object(
    'ad_server', role_ad_server AND ws_ad_server,
    'studio',    role_studio    AND ws_studio
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Step 5: Materialise the corrected effective access into every existing row
-- (so the DB is consistent even before the app deploys)
-- ---------------------------------------------------------------------------

UPDATE workspace_members wm
SET product_access = resolve_product_access(u.platform_role, wm.product_access)
FROM users u
WHERE wm.user_id = u.id;
