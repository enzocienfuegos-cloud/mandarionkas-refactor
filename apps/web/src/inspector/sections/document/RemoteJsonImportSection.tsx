import { useState } from 'react';
import { useFeedActions } from '../../../hooks/use-studio-actions';
import { importRemoteJsonRecords } from './remote-json-import-service';

export function RemoteJsonImportSection(): JSX.Element {
  const { upsertFeedRecord } = useFeedActions();
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<string>('');

  async function handleImport() {
    setStatus('Loading…');
    try {
      const records = await importRemoteJsonRecords(url);
      records.forEach((record) => upsertFeedRecord('custom', record));
      setStatus(`Imported ${records.length} custom records`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Import failed');
    }
  }

  return (
    <div className="field-stack">
      <div>
        <label>JSON URL</label>
        <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/feed.json" />
      </div>
      <div className="meta-line">
        <button onClick={handleImport} disabled={!url.trim()}>Import to custom</button>
        {status ? <span className="pill">{status}</span> : null}
      </div>
      <small className="muted">Supports array payloads, <code>{`{items: []}`}</code>, <code>{`{records: []}`}</code>, or a single object. Imported data lands in the custom feed source.</small>
    </div>
  );
}
