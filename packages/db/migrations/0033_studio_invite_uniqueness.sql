WITH ranked_invites AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY workspace_id, lower(email)
      ORDER BY
        CASE status WHEN 'accepted' THEN 0 ELSE 1 END,
        COALESCE(accepted_at, invited_at) DESC,
        invited_at DESC
    ) AS row_num
  FROM studio_invites
)
DELETE FROM studio_invites si
USING ranked_invites ri
WHERE si.ctid = ri.ctid
  AND ri.row_num > 1;

CREATE UNIQUE INDEX IF NOT EXISTS studio_invites_workspace_email_key
  ON studio_invites(workspace_id, email);
