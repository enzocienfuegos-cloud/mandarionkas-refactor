import type { CSSProperties, ReactElement, ReactNode } from 'react';
import type { PreviewFrame } from '../../../domain/preview/preview-frames';

type StagePreviewShellProps = {
  activePreviewFrame: PreviewFrame;
  previewShellWidth: number;
  previewShellHeight: number;
  previewFrameStyle?: CSSProperties;
  previewPlacementStyle?: CSSProperties;
  stageSurface: ReactElement;
  children?: ReactNode;
};

function buildPreviewShellStyle(width: number, height: number): CSSProperties {
  return { width, height };
}

function renderDeviceShell(activePreviewFrame: PreviewFrame, previewPlacementStyle: CSSProperties | undefined, stageSurface: ReactElement): JSX.Element {
  return (
    <div className="stage-preview-device">
      <div className="stage-preview-device__notch" aria-hidden="true" />
      <div className="stage-preview-device__screen">
        <div className="stage-preview-device__statusbar" aria-hidden="true">
          <span>9:41</span>
          <span>5G</span>
        </div>
        {(activePreviewFrame.chromeTitle || activePreviewFrame.chromeSubtitle) ? (
          <div className={`stage-preview-device__appbar stage-preview-device__appbar--${activePreviewFrame.id}`} aria-hidden="true">
            <div className="stage-preview-device__appcopy">
              {activePreviewFrame.chromeTitle ? <strong>{activePreviewFrame.chromeTitle}</strong> : null}
              {activePreviewFrame.chromeSubtitle ? <span>{activePreviewFrame.chromeSubtitle}</span> : null}
            </div>
            <div className="stage-preview-device__appmeta">
              <span className="stage-preview-device__appdot" />
              <span className="stage-preview-device__appdot" />
              <span className="stage-preview-device__appdot" />
            </div>
          </div>
        ) : null}
        <div className={`stage-preview-device__placement stage-preview-device__placement--${activePreviewFrame.id}`} style={previewPlacementStyle}>
          {stageSurface}
        </div>
        <div className="stage-preview-device__home-indicator" aria-hidden="true" />
      </div>
    </div>
  );
}

function renderWebShell(activePreviewFrame: PreviewFrame, previewPlacementStyle: CSSProperties | undefined, stageSurface: ReactElement): JSX.Element {
  return (
    <div className="stage-preview-browser">
      <div className="stage-preview-browser__bar" aria-hidden="true">
        <span className="stage-preview-browser__dot" />
        <span className="stage-preview-browser__dot" />
        <span className="stage-preview-browser__dot" />
        <div className="stage-preview-browser__url">{activePreviewFrame.chromeUrl ?? 'preview.example/context'}</div>
      </div>
      <div className={`stage-preview-browser__body stage-preview-browser__body--${activePreviewFrame.id}`}>
        <div className="stage-preview-browser__article">
          <div className="stage-preview-browser__eyebrow" aria-hidden="true">{activePreviewFrame.chromeBadge ?? 'Sponsored feature'}</div>
          <div className="stage-preview-browser__headline" aria-hidden="true" />
          <div className="stage-preview-browser__dek" aria-hidden="true" />
          <div className="stage-preview-browser__placement" style={previewPlacementStyle}>
            {stageSurface}
          </div>
          <div className="stage-preview-browser__copyline" aria-hidden="true" />
          <div className="stage-preview-browser__copyline is-wide" aria-hidden="true" />
          <div className="stage-preview-browser__copyline" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

export function StagePreviewShell({
  activePreviewFrame,
  previewShellWidth,
  previewShellHeight,
  previewFrameStyle,
  previewPlacementStyle,
  stageSurface,
  children,
}: StagePreviewShellProps): JSX.Element {
  return (
    <div
      className={`stage-size-shell ${activePreviewFrame.id !== 'none' ? `has-preview-frame preview-frame-shell--${activePreviewFrame.type} preview-frame-shell--${activePreviewFrame.id}` : ''}`.trim()}
      style={buildPreviewShellStyle(previewShellWidth, previewShellHeight)}
    >
      {activePreviewFrame.id === 'none' ? stageSurface : (
        <div
          className={`stage-preview-frame stage-preview-frame--${activePreviewFrame.type} stage-preview-frame--${activePreviewFrame.id}`}
          style={previewFrameStyle}
        >
          {activePreviewFrame.type === 'mobile'
            ? renderDeviceShell(activePreviewFrame, previewPlacementStyle, stageSurface)
            : renderWebShell(activePreviewFrame, previewPlacementStyle, stageSurface)}
        </div>
      )}
      {children}
    </div>
  );
}
