import { useMemo } from 'react';
import { useStudioStore } from '../../../core/store/use-studio-store';
import { getActiveFeedRecord, getBindingSuggestions, getFeedCatalogSources, getFeedRecords } from '../../../domain/document/resolvers';
import { useFeedActions, useUiActions } from '../../../hooks/use-studio-actions';

export function FeedCatalogSection(): JSX.Element {
  const state = useStudioStore((value) => value);
  const { setActiveFeedSource, setActiveFeedRecord } = useUiActions();
  const { upsertFeedRecord, deleteFeedRecord } = useFeedActions();
  const sources = useMemo(() => getFeedCatalogSources(state), [state]);
  const activeSource = state.ui.activeFeedSource;
  const records = getFeedRecords(activeSource, state);
  const activeRecord = getActiveFeedRecord(state, activeSource);
  const suggestions = getBindingSuggestions(activeSource, state);

  return (
    <div className="field-stack">
      <div className="fields-grid">
        <div>
          <label>Source</label>
          <select value={activeSource} onChange={(event) => setActiveFeedSource(event.target.value as typeof activeSource)}>
            {sources.map((source) => <option key={source} value={source}>{source}</option>)}
          </select>
        </div>
        <div>
          <label>Record</label>
          <select value={state.ui.activeFeedRecordId} onChange={(event) => setActiveFeedRecord(event.target.value)}>
            {records.map((record) => <option key={record.id} value={record.id}>{record.label}</option>)}
          </select>
        </div>
      </div>
      <div className="meta-line"><span className="pill">Records {records.length}</span><span className="pill">Fields {Object.keys(activeRecord?.values ?? {}).length}</span></div>
      <div className="field-stack">
        {Object.entries(activeRecord?.values ?? {}).map(([field, value]) => (
          <div key={field} className="fields-grid">
            <div><label>{field}</label><input value={value} onChange={(event) => upsertFeedRecord(activeSource, { ...(activeRecord ?? { id: 'record', label: 'Record', values: {} }), values: { ...(activeRecord?.values ?? {}), [field]: event.target.value } })} /></div>
            <div style={{ alignSelf: 'end' }}><button className="ghost" onClick={() => {
              if (!activeRecord) return;
              const nextValues = { ...activeRecord.values };
              delete nextValues[field];
              upsertFeedRecord(activeSource, { ...activeRecord, values: nextValues });
            }}>Remove field</button></div>
          </div>
        ))}
      </div>
      <div className="meta-line"><span className="pill">Suggestions {suggestions.slice(0, 4).join(', ') || '—'}</span></div>
      <div className="meta-line">
        <button onClick={() => upsertFeedRecord(activeSource, { id: `${activeSource}_${Date.now()}`, label: `Record ${records.length + 1}`, values: { title: 'New record' } })}>Add record</button>
        {activeRecord ? <button className="ghost" onClick={() => deleteFeedRecord(activeSource, activeRecord.id)}>Delete record</button> : null}
      </div>
    </div>
  );
}
