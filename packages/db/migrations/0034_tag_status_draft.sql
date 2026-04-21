-- 0034_tag_status_draft.sql
ALTER TABLE ad_tags
  DROP CONSTRAINT IF EXISTS ad_tags_status_check;

ALTER TABLE ad_tags
  ADD CONSTRAINT ad_tags_status_check
  CHECK (status IN ('draft', 'active', 'paused', 'archived'));
