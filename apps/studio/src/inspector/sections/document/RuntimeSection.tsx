export function RuntimeSection(): JSX.Element {
  return (
    <section className="section section-premium">
      <h3>Runtime</h3>
      <div className="field-stack">
        <small className="muted">Runtime integrations, scene transitions, bindings and story flow are surfaced here as document-level context, not mixed into the canvas shell.</small>
        <div className="meta-line"><span className="pill">Action engine connected</span><span className="pill">Scene transitions live</span></div>
        <div className="meta-line"><span className="pill">Bindings + variants active</span><span className="pill">Story flow enabled</span></div>
      </div>
    </section>
  );
}
