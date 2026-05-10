import { StudioIcon, StudioIcons } from '../../shared/ui/icons';

export function AddClientCard({ onAdd }: { onAdd(): void }): JSX.Element {
  return (
    <button type="button" className="mandarion-add-client-card" onClick={onAdd}>
      <span className="mandarion-add-client-card__icon">
        <StudioIcon icon={StudioIcons.plus} size={28} />
      </span>
      <strong>Crear cliente</strong>
      <small>Sumá un nuevo workspace del studio y abrilo desde este hub.</small>
    </button>
  );
}
