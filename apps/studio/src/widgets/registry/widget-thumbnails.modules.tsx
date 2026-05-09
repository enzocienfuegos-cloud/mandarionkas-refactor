import { ThumbFrame, thumbAlpha, thumbColors } from './widget-thumbnails.shared';

export function AddToCalendarThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.slate900}>
      <rect x="34" y="22" width="92" height="58" rx="14" fill={thumbColors.slate50} />
      <rect x="34" y="22" width="92" height="16" rx="14" fill={thumbColors.red500} />
      <rect x="48" y="48" width="16" height="14" rx="4" fill={thumbColors.amber500} />
      <rect x="72" y="48" width="14" height="4" rx="2" fill={thumbColors.slate900} opacity="0.68" />
      <rect x="72" y="56" width="24" height="4" rx="2" fill={thumbColors.slate900} opacity="0.38" />
    </ThumbFrame>
  );
}

export function ButtonsThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.darkCard}>
      <rect x="24" y="40" width="42" height="18" rx="9" fill={thumbColors.green500} />
      <rect x="72" y="40" width="42" height="18" rx="9" fill={thumbColors.slate50} opacity="0.2" stroke={thumbColors.slate50} strokeOpacity="0.35" />
      <rect x="120" y="40" width="18" height="18" rx="9" fill={thumbColors.amber500} />
    </ThumbFrame>
  );
}

export function CountdownThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.ink900}>
      <rect x="26" y="28" width="32" height="42" rx="10" fill={thumbColors.amber500} opacity="0.92" />
      <rect x="64" y="28" width="32" height="42" rx="10" fill={thumbColors.amber500} opacity="0.92" />
      <rect x="102" y="28" width="32" height="42" rx="10" fill={thumbColors.amber500} opacity="0.92" />
      <circle cx="61" cy="44" r="2.5" fill={thumbColors.slate50} />
      <circle cx="61" cy="56" r="2.5" fill={thumbColors.slate50} />
      <circle cx="99" cy="44" r="2.5" fill={thumbColors.slate50} />
      <circle cx="99" cy="56" r="2.5" fill={thumbColors.slate50} />
    </ThumbFrame>
  );
}

export function DragTokenPoolThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.darkCard}>
      <rect x="24" y="38" width="30" height="24" rx="12" fill={thumbColors.green500} />
      <rect x="60" y="38" width="30" height="24" rx="12" fill={thumbColors.slate50} opacity="0.18" stroke={thumbColors.slate50} strokeOpacity="0.3" />
      <rect x="96" y="38" width="40" height="24" rx="12" fill={thumbColors.green500} opacity="0.72" />
    </ThumbFrame>
  );
}

export function DropZoneThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.darkCard}>
      <rect x="32" y="22" width="96" height="56" rx="14" fill="none" stroke={thumbColors.green500} strokeWidth="2.5" strokeDasharray="7 6" />
      <path d="M80 34V56" stroke={thumbColors.slate50} strokeWidth="3" strokeLinecap="round" />
      <path d="M70 48L80 58L90 48" stroke={thumbColors.slate50} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </ThumbFrame>
  );
}

export function FormThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.darkCard}>
      <rect x="28" y="20" width="104" height="14" rx="7" fill={thumbColors.slate50} opacity="0.16" />
      <rect x="28" y="40" width="104" height="12" rx="6" fill={thumbColors.slate50} opacity="0.14" />
      <rect x="28" y="58" width="104" height="12" rx="6" fill={thumbColors.slate50} opacity="0.14" />
      <rect x="52" y="76" width="56" height="10" rx="5" fill={thumbColors.pink500} />
    </ThumbFrame>
  );
}

export function FourFacesThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.darkCard}>
      <rect x="28" y="20" width="42" height="24" rx="8" fill={thumbColors.amber500} />
      <rect x="76" y="20" width="42" height="24" rx="8" fill={thumbColors.green500} />
      <rect x="28" y="50" width="42" height="24" rx="8" fill={thumbColors.slate50} opacity="0.16" />
      <rect x="76" y="50" width="42" height="24" rx="8" fill={thumbColors.red500} />
      <circle cx="72" cy="84" r="3" fill={thumbColors.slate50} />
      <circle cx="80" cy="84" r="3" fill={thumbColors.slate50} opacity="0.42" />
      <circle cx="88" cy="84" r="3" fill={thumbColors.slate50} opacity="0.42" />
    </ThumbFrame>
  );
}

export function GenAiImageThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.ink900}>
      <rect x="30" y="22" width="100" height="56" rx="14" fill={thumbColors.cyan400} opacity="0.16" stroke={thumbColors.cyan400} strokeWidth="1.5" />
      <path d="M54 54L74 34L90 48L106 32L126 54H54Z" fill={thumbColors.slate50} opacity="0.85" />
      <path d="M46 34L48 38L52 40L48 42L46 46L44 42L40 40L44 38Z" fill={thumbColors.amber500} />
      <path d="M116 24L117.5 27L121 28L117.5 29L116 32L114.5 29L111 28L114.5 27Z" fill={thumbColors.slate50} />
    </ThumbFrame>
  );
}

export function InteractiveGalleryThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.darkCard}>
      <rect x="28" y="22" width="42" height="24" rx="8" fill={thumbColors.green500} opacity="0.92" />
      <rect x="76" y="22" width="42" height="24" rx="8" fill={thumbColors.slate50} opacity="0.2" />
      <rect x="28" y="52" width="42" height="24" rx="8" fill={thumbColors.amber500} opacity="0.86" />
      <rect x="76" y="52" width="42" height="24" rx="8" fill={thumbColors.slate50} opacity="0.12" />
    </ThumbFrame>
  );
}

export function InteractiveHotspotThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.darkCard}>
      <rect x="28" y="22" width="104" height="56" rx="14" fill={thumbColors.slate50} opacity="0.12" />
      <circle cx="80" cy="50" r="16" fill={thumbColors.green500} opacity="0.22" />
      <circle cx="80" cy="50" r="9" fill={thumbColors.green500} />
      <path d="M80 45V55M75 50H85" stroke={thumbColors.slate900} strokeWidth="3" strokeLinecap="round" />
    </ThumbFrame>
  );
}

export function InteractiveVideoThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.slate900}>
      <rect x="44" y="14" width="72" height="72" rx="20" fill={thumbColors.navy950} stroke={thumbColors.sky400} opacity="0.38" />
      <circle cx="80" cy="50" r="16" fill={thumbColors.slate50} opacity="0.16" />
      <path d="M74 40L92 50L74 60V40Z" fill={thumbColors.slate50} />
      <circle cx="106" cy="30" r="6" fill={thumbColors.green500} />
      <path d="M106 26V34M102 30H110" stroke={thumbColors.slate900} strokeWidth="2" strokeLinecap="round" />
    </ThumbFrame>
  );
}

export function InteractiveVideoLibraryPreview(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.slate900}>
      <rect x="44" y="14" width="72" height="72" rx="20" fill={thumbColors.navy950} stroke={thumbColors.sky400} opacity="0.38" />
      <rect x="50" y="72" width="60" height="4" rx="2" fill={thumbAlpha.white18} />
      <rect x="50" y="72" width="20" height="4" rx="2" fill={thumbColors.green500}>
        <animate attributeName="width" values="12;46;12" dur="1.8s" repeatCount="indefinite" />
      </rect>
      <circle cx="80" cy="50" r="16" fill={thumbColors.slate50} opacity="0.16">
        <animate attributeName="opacity" values="0.12;0.22;0.12" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <path d="M74 40L92 50L74 60V40Z" fill={thumbColors.slate50} />
      <circle cx="106" cy="30" r="6" fill={thumbColors.green500}>
        <animate attributeName="r" values="5;7;5" dur="1.2s" repeatCount="indefinite" />
      </circle>
      <path d="M106 26V34M102 30H110" stroke={thumbColors.slate900} strokeWidth="2" strokeLinecap="round" />
    </ThumbFrame>
  );
}

export function ParticleHaloThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.darkCard}>
      <circle cx="80" cy="50" r="16" fill={thumbColors.cyan400} opacity="0.9" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, index) => {
        const radians = (angle * Math.PI) / 180;
        const x = 80 + Math.cos(radians) * 28;
        const y = 50 + Math.sin(radians) * 28;
        return <circle key={`halo-${index}`} cx={x} cy={y} r="3.5" fill={thumbColors.slate50} opacity="0.72" />;
      })}
    </ThumbFrame>
  );
}

export function QrCodeThumb(): JSX.Element {
  const cells = [
    [0, 0], [1, 0], [2, 0], [4, 0], [5, 0],
    [0, 1], [2, 1], [4, 1],
    [0, 2], [1, 2], [2, 2], [5, 2],
    [3, 3], [4, 3], [1, 4], [2, 4], [5, 4],
    [0, 5], [2, 5], [3, 5], [4, 5], [5, 5],
  ];
  return (
    <ThumbFrame background={thumbColors.white}>
      <rect x="40" y="20" width="80" height="60" rx="12" fill={thumbColors.white} stroke={thumbColors.ink900} opacity="0.18" />
      {cells.map(([cx, cy], index) => (
        <rect key={`qr-${index}`} x={48 + cx * 10} y={28 + cy * 8} width="8" height="6" rx="1.5" fill={thumbColors.ink900} />
      ))}
      <rect x="46" y="26" width="18" height="14" rx="3" fill="none" stroke={thumbColors.ink900} strokeWidth="2" />
      <rect x="96" y="26" width="18" height="14" rx="3" fill="none" stroke={thumbColors.ink900} strokeWidth="2" />
      <rect x="46" y="58" width="18" height="14" rx="3" fill="none" stroke={thumbColors.ink900} strokeWidth="2" />
    </ThumbFrame>
  );
}

export function RangeSliderThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.darkCard}>
      <rect x="30" y="48" width="100" height="6" rx="3" fill={thumbColors.slate50} opacity="0.18" />
      <rect x="52" y="48" width="44" height="6" rx="3" fill={thumbColors.green500} />
      <circle cx="52" cy="51" r="7" fill={thumbColors.slate50} />
      <circle cx="96" cy="51" r="7" fill={thumbColors.slate50} />
    </ThumbFrame>
  );
}

export function ScratchRevealThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.darkCard}>
      <rect x="28" y="20" width="104" height="60" rx="16" fill={thumbColors.amber500} opacity="0.82" />
      <path d="M34 30L126 72M34 42L112 78M48 24L132 62" stroke={thumbColors.slate50} strokeWidth="4" opacity="0.42" />
      <rect x="44" y="34" width="72" height="32" rx="10" fill={thumbColors.ink900} opacity="0.22" />
    </ThumbFrame>
  );
}

export function ShoppableSidebarThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.darkCard}>
      <rect x="20" y="20" width="72" height="60" rx="12" fill={thumbColors.amber500} opacity="0.84" />
      <rect x="100" y="22" width="38" height="16" rx="8" fill={thumbColors.slate50} opacity="0.18" />
      <rect x="100" y="42" width="38" height="16" rx="8" fill={thumbColors.slate50} opacity="0.18" />
      <rect x="100" y="62" width="38" height="16" rx="8" fill={thumbColors.slate50} opacity="0.18" />
    </ThumbFrame>
  );
}

export function SliderThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.darkCard}>
      <rect x="24" y="28" width="112" height="46" rx="14" fill={thumbColors.slate50} opacity="0.12" />
      <rect x="24" y="28" width="52" height="46" rx="14" fill={thumbColors.pink500} opacity="0.72" />
      <rect x="76" y="26" width="4" height="50" rx="2" fill={thumbColors.white} />
      <circle cx="78" cy="51" r="8" fill={thumbColors.white} opacity="0.92" />
    </ThumbFrame>
  );
}

export function SpeedTestThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.darkCard}>
      <path d="M44 68A36 36 0 0 1 116 68" fill="none" stroke={thumbColors.cyan400} strokeWidth="8" strokeLinecap="round" />
      <path d="M80 68L104 44" stroke={thumbColors.slate50} strokeWidth="4" strokeLinecap="round" />
      <circle cx="80" cy="68" r="6" fill={thumbColors.slate50} />
    </ThumbFrame>
  );
}

export function StepIndicatorThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.darkCard}>
      <path d="M46 50H114" stroke={thumbColors.slate50} strokeWidth="4" opacity="0.22" strokeLinecap="round" />
      <circle cx="50" cy="50" r="9" fill={thumbColors.green500} />
      <circle cx="80" cy="50" r="9" fill={thumbColors.slate50} opacity="0.26" />
      <circle cx="110" cy="50" r="9" fill={thumbColors.slate50} opacity="0.26" />
    </ThumbFrame>
  );
}

export function TikTokVideoThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.ink900}>
      <rect x="52" y="10" width="56" height="80" rx="18" fill={thumbColors.ink900} stroke={thumbColors.slate800} />
      <path d="M72 36L90 46L72 56V36Z" fill={thumbColors.slate50} />
      <path d="M110 38C110 34 113 31 117 31C121 31 124 34 124 38C124 43 117 48 117 48C117 48 110 43 110 38Z" fill={thumbColors.pink500} />
      <rect x="64" y="72" width="32" height="4" rx="2" fill={thumbColors.slate50} opacity="0.58" />
    </ThumbFrame>
  );
}

export function TimerBarThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.darkCard}>
      <rect x="28" y="46" width="104" height="10" rx="5" fill={thumbColors.slate50} opacity="0.16" />
      <rect x="28" y="46" width="64" height="10" rx="5" fill={thumbColors.cyan400} />
    </ThumbFrame>
  );
}

export function TravelDealThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.slateSoft}>
      <path d="M34 54L74 44L108 30L116 36L92 48L110 54L104 60L84 56L70 66L60 64L68 54L34 60Z" fill={thumbColors.facebookBlue} />
      <rect x="96" y="58" width="28" height="14" rx="7" fill={thumbColors.amber500} />
      <rect x="102" y="62" width="16" height="4" rx="2" fill={thumbColors.slate900} opacity="0.78" />
    </ThumbFrame>
  );
}

export function VerticalAccordionThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.ink900}>
      <rect x="28" y="20" width="104" height="14" rx="7" fill={thumbColors.facebookBlue} />
      <rect x="28" y="38" width="104" height="12" rx="6" fill={thumbColors.slate50} opacity="0.18" />
      <rect x="28" y="54" width="104" height="24" rx="10" fill={thumbColors.amber500} opacity="0.82" />
      <rect x="28" y="82" width="104" height="10" rx="5" fill={thumbColors.slate50} opacity="0.14" />
    </ThumbFrame>
  );
}

export function WeatherConditionsThumb(): JSX.Element {
  return (
    <ThumbFrame background={thumbColors.slateSoft}>
      <circle cx="58" cy="42" r="14" fill={thumbColors.amber500} />
      <path d="M54 64H104C111 64 116 59 116 52C116 45 110 40 103 40C101 32 94 26 86 26C76 26 68 34 68 44C60 45 54 51 54 58C54 61 55 63 58 64Z" fill={thumbColors.white} />
      <rect x="62" y="72" width="38" height="6" rx="3" fill={thumbColors.slate900} opacity="0.42" />
    </ThumbFrame>
  );
}
