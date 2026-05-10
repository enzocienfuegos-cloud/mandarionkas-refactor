import { StudioIcon, StudioIcons } from '../../shared/ui/icons';

export function AddClientCard({ onAdd }: { onAdd(): void }): JSX.Element {
  return (
    <button type="button" className="agency-add-client-card" onClick={onAdd}>
      <span className="agency-add-client-card__icon">
        <StudioIcon icon={StudioIcons.plus} size={28} />
      </span>
      <strong>Add client</strong>
      <small>Bring a new brand or agency client into this workspace.</small>
    </button>
  );
}
