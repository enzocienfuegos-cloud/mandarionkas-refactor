CREATE TABLE IF NOT EXISTS studio_brands (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  primary_color    TEXT,
  secondary_color  TEXT,
  accent_color     TEXT,
  logo_url         TEXT,
  font_family      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS studio_brands_workspace_idx ON studio_brands(workspace_id, created_at ASC);

CREATE TABLE IF NOT EXISTS studio_invites (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email          TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'reviewer')),
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  invited_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS studio_invites_workspace_idx ON studio_invites(workspace_id, invited_at DESC);
CREATE INDEX IF NOT EXISTS studio_invites_email_idx ON studio_invites(lower(email));

CREATE TABLE IF NOT EXISTS studio_project_versions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES studio_projects(id) ON DELETE CASCADE,
  version_number   INTEGER NOT NULL,
  note             TEXT,
  state            JSONB NOT NULL DEFAULT '{}',
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, version_number)
);

CREATE INDEX IF NOT EXISTS studio_project_versions_project_idx ON studio_project_versions(project_id, version_number DESC);

INSERT INTO studio_brands (
  workspace_id,
  name,
  primary_color,
  secondary_color,
  accent_color,
  logo_url,
  font_family
)
SELECT
  w.id,
  brand.value->>'name',
  brand.value->>'primaryColor',
  brand.value->>'secondaryColor',
  brand.value->>'accentColor',
  brand.value->>'logoUrl',
  brand.value->>'fontFamily'
FROM workspaces w
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(w.settings->'brands', '[]'::jsonb)) AS brand(value)
WHERE NOT EXISTS (
  SELECT 1
  FROM studio_brands sb
  WHERE sb.workspace_id = w.id
    AND sb.name = brand.value->>'name'
);

INSERT INTO studio_invites (
  workspace_id,
  email,
  role,
  status,
  invited_at
)
SELECT
  w.id,
  invite.value->>'email',
  CASE invite.value->>'role'
    WHEN 'owner' THEN 'owner'
    WHEN 'reviewer' THEN 'reviewer'
    ELSE 'editor'
  END,
  CASE invite.value->>'status'
    WHEN 'accepted' THEN 'accepted'
    ELSE 'pending'
  END,
  COALESCE((invite.value->>'invitedAt')::timestamptz, NOW())
FROM workspaces w
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(w.settings->'invites', '[]'::jsonb)) AS invite(value)
WHERE NOT EXISTS (
  SELECT 1
  FROM studio_invites si
  WHERE si.workspace_id = w.id
    AND lower(si.email) = lower(invite.value->>'email')
);
