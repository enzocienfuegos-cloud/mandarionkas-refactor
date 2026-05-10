import { StudioIcon, StudioIcons } from '../../shared/ui/icons';

export function AddClientCard({ onAdd }: { onAdd(): void }): JSX.Element {
  return (
    <button type="button" className="add-client-card" onClick={onAdd}>
      <span className="add-client-card__icon">
        <StudioIcon icon={StudioIcons.plus} size={28} />
      </span>
      <strong>Create client</strong>
      <small>Add a new account to the hub and open its operational workspace from here.</small>
    </button>
  );
}
