-- Migration 0042: NOTIFY trigger for creative_ingestions html5 publish queue.
--
-- Mirrors the video transcode trigger in 0027. When the API transitions an
-- HTML5 ingestion into processing and attaches a creative_version_id, notify the
-- worker bridge so it can enqueue the pg-boss publish job without the API
-- writing directly into pg-boss internals.

CREATE OR REPLACE FUNCTION notify_html5_publish_pending()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'processing'
     AND NEW.source_kind = 'html5_zip'
     AND NEW.creative_version_id IS NOT NULL
     AND (TG_OP = 'INSERT'
          OR OLD.status IS DISTINCT FROM NEW.status
          OR OLD.creative_version_id IS DISTINCT FROM NEW.creative_version_id)
  THEN
    PERFORM pg_notify('smx.publish-html5-archive', NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_html5_publish_notify ON creative_ingestions;

CREATE TRIGGER trg_html5_publish_notify
  AFTER INSERT OR UPDATE ON creative_ingestions
  FOR EACH ROW
  EXECUTE FUNCTION notify_html5_publish_pending();
