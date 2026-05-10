export function AgencyShellEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}): JSX.Element {
  return (
    <div className="agency-empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
