import { StudioIcon, StudioIcons } from '../../shared/ui/icons';

export function AddClientCard({ onAdd }: { onAdd(): void }): JSX.Element {
  return (
    <button type="button" className="add-client-card" onClick={onAdd}>
      <span className="add-client-card__icon">
        <StudioIcon icon={StudioIcons.plus} size={28} />
      </span>
      <strong>Crear cliente</strong>
      <small>Sumá una nueva cuenta al hub y abrí su workspace operativo desde acá.</small>
    </button>
  );
}
