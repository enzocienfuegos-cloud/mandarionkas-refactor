export function StageRulers({ workspaceWidth, workspaceHeight }: { workspaceWidth: number; workspaceHeight: number }): JSX.Element {
  const gutter = 28;
  const usableWidth = Math.max(0, workspaceWidth - gutter);
  const usableHeight = Math.max(0, workspaceHeight - gutter);
  const majorStep = usableWidth >= 1600 || usableHeight >= 1000 ? 100 : 50;
  const minorStep = majorStep / 2;
  const horizontalTicks = Array.from({ length: Math.floor(usableWidth / minorStep) + 1 }, (_, index) => index * minorStep);
  const verticalTicks = Array.from({ length: Math.floor(usableHeight / minorStep) + 1 }, (_, index) => index * minorStep);

  return (
    <>
      <div className="stage-ruler-corner"><span>px</span></div>
      <div className="stage-ruler stage-ruler-top">
        {horizontalTicks.map((value) => {
          const major = value % majorStep === 0;
          return (
            <span key={`h-${value}`} className={`stage-ruler-tick ${major ? 'major' : 'minor'}`} style={{ left: value }}>
              {major ? <small>{value}</small> : null}
            </span>
          );
        })}
      </div>
      <div className="stage-ruler stage-ruler-left">
        {verticalTicks.map((value) => {
          const major = value % majorStep === 0;
          return (
            <span key={`v-${value}`} className={`stage-ruler-tick ${major ? 'major' : 'minor'}`} style={{ top: value }}>
              {major ? <small>{value}</small> : null}
            </span>
          );
        })}
      </div>
    </>
  );
}
