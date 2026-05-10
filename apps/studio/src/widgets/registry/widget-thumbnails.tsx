import { ThumbFrame, thumbAlpha, thumbColors } from './widget-thumbnails.shared';

export { PlaceholderThumb } from './widget-thumbnails.shared';
export * from './widget-thumbnails.modules';

export function ImageThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.ocean950}>
      <rect x="16" y="16" width="128" height="68" rx="16" fill={thumbColors.slateSoft} opacity="0.18" />
      <rect x="24" y="24" width="112" height="52" rx="12" fill={thumbColors.ocean700} opacity="0.26" />
      <circle cx="48" cy="40" r="8" fill={thumbColors.amber500} />
      <path d="M30 72L62 46L80 60L98 42L130 72H30Z" fill={thumbColors.slateSoft} opacity="0.95" />
    </ThumbFrame>
  );
}

export function HeroImageThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.ocean700}>
      <rect x="18" y="18" width="124" height="64" rx="18" fill={thumbColors.ocean950} opacity="0.58" />
      <path d="M26 74L60 40L84 56L106 34L134 74H26Z" fill={thumbColors.slateSoft} opacity="0.9" />
      <rect x="26" y="26" width="46" height="10" rx="5" fill={thumbColors.white} opacity="0.88" />
    </ThumbFrame>
  );
}

export function TextThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.ink900}>
      <rect x="22" y="22" width="116" height="56" rx="14" fill={thumbAlpha.white05} />
      <rect x="30" y="30" width="78" height="10" rx="5" fill={thumbColors.slate50} />
      <rect x="30" y="46" width="96" height="7" rx="3.5" fill={thumbColors.slate50} opacity="0.72" />
      <rect x="30" y="58" width="88" height="7" rx="3.5" fill={thumbColors.slate50} opacity="0.48" />
    </ThumbFrame>
  );
}

export function CtaThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.darkCard}>
      <rect x="26" y="24" width="108" height="18" rx="9" fill={thumbColors.slate50} opacity="0.24" />
      <rect x="38" y="56" width="84" height="22" rx="11" fill={thumbColors.amber500} />
      <rect x="56" y="63" width="48" height="8" rx="4" fill={thumbColors.ink900} opacity="0.88" />
    </ThumbFrame>
  );
}

export function VideoThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.navy950}>
      <rect x="20" y="18" width="120" height="64" rx="16" fill={thumbColors.slate900} stroke={thumbAlpha.white12} />
      <circle cx="80" cy="50" r="17" fill={thumbAlpha.white12} stroke={thumbAlpha.white18} />
      <path d="M74 40L92 50L74 60V40Z" fill={thumbColors.slate50} />
      <rect x="28" y="72" width="84" height="4" rx="2" fill={thumbColors.slate50} opacity="0.3" />
      <rect x="28" y="72" width="30" height="4" rx="2" fill={thumbColors.amber500} />
    </ThumbFrame>
  );
}

export function CarouselThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.darkCard}>
      <rect x="16" y="20" width="54" height="60" rx="12" fill={thumbColors.pink500} opacity="0.88" />
      <rect x="53" y="20" width="54" height="60" rx="12" fill={thumbColors.amber500} opacity="0.82" />
      <rect x="90" y="20" width="54" height="60" rx="12" fill={thumbColors.green500} opacity="0.76" />
      <circle cx="78" cy="88" r="3" fill={thumbColors.slate50} opacity="0.9" />
      <circle cx="86" cy="88" r="3" fill={thumbColors.slate50} opacity="0.42" />
      <circle cx="94" cy="88" r="3" fill={thumbColors.slate50} opacity="0.42" />
    </ThumbFrame>
  );
}

export function CarouselLibraryPreview(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.darkCard}>
      <rect x="16" y="20" width="128" height="60" rx="12" fill={thumbAlpha.white05} stroke={thumbAlpha.white12} />
      <g>
        <g>
          <rect x="16" y="20" width="54" height="60" rx="12" fill={thumbColors.pink500} opacity="0.88" />
          <rect x="53" y="20" width="54" height="60" rx="12" fill={thumbColors.amber500} opacity="0.82" />
          <rect x="90" y="20" width="54" height="60" rx="12" fill={thumbColors.green500} opacity="0.76" />
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;-18 0;0 0"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </g>
      </g>
      <circle cx="76" cy="88" r="3" fill={thumbColors.slate50} opacity="0.95">
        <animate attributeName="opacity" values="0.95;0.4;0.4;0.95" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <circle cx="84" cy="88" r="3" fill={thumbColors.slate50} opacity="0.4">
        <animate attributeName="opacity" values="0.4;0.95;0.4;0.4" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <circle cx="92" cy="88" r="3" fill={thumbColors.slate50} opacity="0.4">
        <animate attributeName="opacity" values="0.4;0.4;0.95;0.4" dur="1.8s" repeatCount="indefinite" />
      </circle>
    </ThumbFrame>
  );
}

export function StoryThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.ink900}>
      <rect x="52" y="10" width="56" height="80" rx="20" fill={thumbColors.ink900} stroke={thumbAlpha.white18} />
      <rect x="58" y="16" width="44" height="4" rx="2" fill={thumbColors.slate50} opacity="0.8" />
      <rect x="60" y="28" width="40" height="48" rx="14" fill={thumbColors.pink500} opacity="0.65" />
      <circle cx="70" cy="28" r="8" fill={thumbColors.amber500} />
      <rect x="66" y="80" width="28" height="4" rx="2" fill={thumbColors.slate50} opacity="0.62" />
    </ThumbFrame>
  );
}

export function SocialCarouselThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.slate50}>
      <rect x="20" y="18" width="120" height="64" rx="14" fill={thumbColors.white} stroke={thumbColors.slate300} />
      <circle cx="34" cy="30" r="7" fill={thumbColors.facebookBlue} />
      <rect x="46" y="24" width="34" height="6" rx="3" fill={thumbColors.slate900} opacity="0.78" />
      <rect x="26" y="42" width="34" height="28" rx="8" fill={thumbColors.amber500} opacity="0.82" />
      <rect x="64" y="42" width="34" height="28" rx="8" fill={thumbColors.green500} opacity="0.8" />
      <rect x="102" y="42" width="18" height="28" rx="8" fill={thumbColors.facebookBlue} opacity="0.74" />
    </ThumbFrame>
  );
}

export function SocialCarouselLibraryPreview(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.slate50}>
      <rect x="20" y="18" width="120" height="64" rx="14" fill={thumbColors.white} stroke={thumbColors.slate300} />
      <circle cx="34" cy="30" r="7" fill={thumbColors.facebookBlue} />
      <rect x="46" y="24" width="34" height="6" rx="3" fill={thumbColors.slate900} opacity="0.78" />
      <g>
        <rect x="26" y="42" width="34" height="28" rx="8" fill={thumbColors.amber500} opacity="0.82" />
        <rect x="64" y="42" width="34" height="28" rx="8" fill={thumbColors.green500} opacity="0.8" />
        <rect x="102" y="42" width="18" height="28" rx="8" fill={thumbColors.facebookBlue} opacity="0.74" />
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0;-12 0;0 0"
          dur="1.8s"
          repeatCount="indefinite"
        />
      </g>
      <rect x="30" y="74" width="90" height="3" rx="1.5" fill={thumbColors.slate300} />
      <rect x="30" y="74" width="30" height="3" rx="1.5" fill={thumbColors.facebookBlue}>
        <animate attributeName="width" values="24;56;24" dur="1.8s" repeatCount="indefinite" />
      </rect>
    </ThumbFrame>
  );
}

export function TeadsLayout1Thumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.white}>
      <rect x="22" y="18" width="116" height="64" rx="14" fill={thumbColors.white} stroke={thumbColors.slate300} />
      <circle cx="36" cy="30" r="7" fill={thumbColors.slate900} opacity="0.84" />
      <rect x="48" y="24" width="42" height="6" rx="3" fill={thumbColors.slate900} opacity="0.72" />
      <rect x="30" y="40" width="100" height="22" rx="10" fill={thumbColors.slate300} />
      <rect x="30" y="66" width="58" height="8" rx="4" fill={thumbColors.slate900} opacity="0.22" />
      <rect x="96" y="64" width="28" height="12" rx="6" fill={thumbColors.slate300} />
    </ThumbFrame>
  );
}

export function TeadsLayout2Thumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.white}>
      <rect x="22" y="18" width="116" height="64" rx="14" fill={thumbColors.white} stroke={thumbColors.slate300} />
      <rect x="30" y="28" width="100" height="26" rx="10" fill={thumbColors.slate300} />
      <rect x="30" y="58" width="100" height="14" rx="7" fill={thumbColors.facebookBlue} />
      <rect x="42" y="62" width="34" height="6" rx="3" fill={thumbColors.white} opacity="0.92" />
    </ThumbFrame>
  );
}

export function MapThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.slateSoft}>
      <rect x="20" y="18" width="120" height="64" rx="16" fill={thumbColors.slateSoft} stroke={thumbColors.blue300} />
      <path d="M20 54H140" stroke={thumbColors.blue300} strokeWidth="4" opacity="0.65" />
      <path d="M56 18V82" stroke={thumbColors.blue300} strokeWidth="4" opacity="0.45" />
      <path d="M100 18V82" stroke={thumbColors.blue300} strokeWidth="4" opacity="0.45" />
      <path d="M82 34C82 26.82 76.18 21 69 21C61.82 21 56 26.82 56 34C56 45 69 56 69 56C69 56 82 45 82 34Z" fill={thumbColors.red500} />
      <circle cx="69" cy="34" r="4.5" fill={thumbColors.white} />
      <rect x="94" y="28" width="28" height="22" rx="8" fill={thumbColors.green500} opacity="0.9" />
      <rect x="98" y="35" width="20" height="6" rx="3" fill={thumbColors.white} opacity="0.88" />
    </ThumbFrame>
  );
}

export function BadgeThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.slate800}>
      <rect x="24" y="34" width="112" height="32" rx="16" fill={thumbColors.violet400} opacity="0.92" />
      <path d="M46 42L48.8 47.8L55 48.7L50.5 53L51.6 59L46 56L40.4 59L41.5 53L37 48.7L43.2 47.8Z" fill={thumbColors.slate50} />
      <rect x="64" y="45" width="46" height="8" rx="4" fill={thumbColors.slate50} opacity="0.92" />
    </ThumbFrame>
  );
}

export function GroupThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.purple950}>
      <rect x="34" y="26" width="62" height="42" rx="12" fill={thumbColors.violet400} opacity="0.4" stroke={thumbColors.violet400} strokeWidth="2" />
      <rect x="64" y="36" width="62" height="42" rx="12" fill={thumbColors.violet50} opacity="0.14" stroke={thumbColors.violet50} strokeWidth="2.5" />
    </ThumbFrame>
  );
}

export function ShapeThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.purple950}>
      <circle cx="50" cy="50" r="16" fill={thumbColors.amber500} />
      <rect x="68" y="32" width="26" height="26" rx="8" fill={thumbColors.green500} />
      <path d="M110 68L94 40H126L110 68Z" fill={thumbColors.violet400} />
    </ThumbFrame>
  );
}
