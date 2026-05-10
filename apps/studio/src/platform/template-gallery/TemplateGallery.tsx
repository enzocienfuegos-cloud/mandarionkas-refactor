import { TemplateMarketplace } from './TemplateMarketplace';

export function TemplateGallery({
  onUseTemplate,
}: {
  onUseTemplate?: (templateId: string) => void;
}): JSX.Element {
  return (
    <section className="template-gallery">
      <div className="template-gallery__head">
        <div>
          <p className="section-kicker">Templates</p>
          <h2>Fewer, stronger launch points</h2>
          <p>Start from a tighter set of campaign-ready structures instead of scrolling through generic placeholders.</p>
        </div>
        <span className="pill">Curated marketplace</span>
      </div>
      <TemplateMarketplace onUseTemplate={(templateId) => onUseTemplate?.(templateId)} showVerticalFilters />
    </section>
  );
}
