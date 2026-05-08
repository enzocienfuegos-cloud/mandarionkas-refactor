type Category = 'content' | 'media' | 'interactive' | 'layout';

function ThumbFrame({
  background,
  children,
}: {
  background: string;
  children: import('react').ReactNode;
}): JSX.Element {
  return (
    <svg viewBox="0 0 160 100" aria-hidden="true" className="widget-thumb-svg">
      <rect x="0" y="0" width="160" height="100" rx="18" fill={background} />
      {children}
    </svg>
  );
}

export function PlaceholderThumb({ category }: { category: Category }): JSX.Element {
  const palette = {
    content: { bg: '#1f2937', fg: '#f8fafc', accent: '#f59e0b' },
    media: { bg: '#0f172a', fg: '#dbeafe', accent: '#38bdf8' },
    interactive: { bg: '#172033', fg: '#f8fafc', accent: '#22c55e' },
    layout: { bg: '#241b34', fg: '#f5f3ff', accent: '#a78bfa' },
  }[category];

  return (
    <ThumbFrame background={palette.bg}>
      <rect x="16" y="18" width="128" height="64" rx="14" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" />
      <rect x="30" y="32" width="48" height="36" rx="10" fill={palette.accent} opacity="0.9" />
      <rect x="88" y="34" width="38" height="8" rx="4" fill={palette.fg} opacity="0.88" />
      <rect x="88" y="48" width="28" height="6" rx="3" fill={palette.fg} opacity="0.5" />
      <rect x="88" y="60" width="20" height="6" rx="3" fill={palette.fg} opacity="0.32" />
    </ThumbFrame>
  );
}

export function ImageThumb(): JSX.Element {
  return (
    <ThumbFrame background="#0f2742">
      <rect x="16" y="16" width="128" height="68" rx="16" fill="#e0f2fe" opacity="0.18" />
      <rect x="24" y="24" width="112" height="52" rx="12" fill="#0f766e" opacity="0.26" />
      <circle cx="48" cy="40" r="8" fill="#fef08a" />
      <path d="M30 72L62 46L80 60L98 42L130 72H30Z" fill="#dbeafe" opacity="0.95" />
    </ThumbFrame>
  );
}

export function HeroImageThumb(): JSX.Element {
  return (
    <ThumbFrame background="#123b63">
      <rect x="18" y="18" width="124" height="64" rx="18" fill="#082f49" opacity="0.58" />
      <path d="M26 74L60 40L84 56L106 34L134 74H26Z" fill="#e0f2fe" opacity="0.9" />
      <rect x="26" y="26" width="46" height="10" rx="5" fill="#ffffff" opacity="0.88" />
    </ThumbFrame>
  );
}

export function TextThumb(): JSX.Element {
  return (
    <ThumbFrame background="#111827">
      <rect x="22" y="22" width="116" height="56" rx="14" fill="rgba(255,255,255,0.05)" />
      <rect x="30" y="30" width="78" height="10" rx="5" fill="#f8fafc" />
      <rect x="30" y="46" width="96" height="7" rx="3.5" fill="#f8fafc" opacity="0.72" />
      <rect x="30" y="58" width="88" height="7" rx="3.5" fill="#f8fafc" opacity="0.48" />
    </ThumbFrame>
  );
}

export function CtaThumb(): JSX.Element {
  return (
    <ThumbFrame background="#1a1f2b">
      <rect x="26" y="24" width="108" height="18" rx="9" fill="#f8fafc" opacity="0.24" />
      <rect x="38" y="56" width="84" height="22" rx="11" fill="#f59e0b" />
      <rect x="56" y="63" width="48" height="8" rx="4" fill="#111827" opacity="0.88" />
    </ThumbFrame>
  );
}

export function VideoThumb(): JSX.Element {
  return (
    <ThumbFrame background="#020617">
      <rect x="20" y="18" width="120" height="64" rx="16" fill="#0f172a" stroke="rgba(255,255,255,0.12)" />
      <circle cx="80" cy="50" r="17" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.24)" />
      <path d="M74 40L92 50L74 60V40Z" fill="#f8fafc" />
      <rect x="28" y="72" width="84" height="4" rx="2" fill="#f8fafc" opacity="0.3" />
      <rect x="28" y="72" width="30" height="4" rx="2" fill="#f59e0b" />
    </ThumbFrame>
  );
}

export function CarouselThumb(): JSX.Element {
  return (
    <ThumbFrame background="#18222d">
      <rect x="16" y="20" width="54" height="60" rx="12" fill="#fb7185" opacity="0.88" />
      <rect x="53" y="20" width="54" height="60" rx="12" fill="#f59e0b" opacity="0.82" />
      <rect x="90" y="20" width="54" height="60" rx="12" fill="#22c55e" opacity="0.76" />
      <circle cx="78" cy="88" r="3" fill="#f8fafc" opacity="0.9" />
      <circle cx="86" cy="88" r="3" fill="#f8fafc" opacity="0.42" />
      <circle cx="94" cy="88" r="3" fill="#f8fafc" opacity="0.42" />
    </ThumbFrame>
  );
}

export function StoryThumb(): JSX.Element {
  return (
    <ThumbFrame background="#09090b">
      <rect x="52" y="10" width="56" height="80" rx="20" fill="#111827" stroke="rgba(255,255,255,0.16)" />
      <rect x="58" y="16" width="44" height="4" rx="2" fill="#f8fafc" opacity="0.8" />
      <rect x="60" y="28" width="40" height="48" rx="14" fill="#ec4899" opacity="0.65" />
      <circle cx="70" cy="28" r="8" fill="#f59e0b" />
      <rect x="66" y="80" width="28" height="4" rx="2" fill="#f8fafc" opacity="0.62" />
    </ThumbFrame>
  );
}

export function SocialCarouselThumb(): JSX.Element {
  return (
    <ThumbFrame background="#f8fafc">
      <rect x="20" y="18" width="120" height="64" rx="14" fill="#ffffff" stroke="#cbd5e1" />
      <circle cx="34" cy="30" r="7" fill="#1877f2" />
      <rect x="46" y="24" width="34" height="6" rx="3" fill="#0f172a" opacity="0.78" />
      <rect x="26" y="42" width="34" height="28" rx="8" fill="#f59e0b" opacity="0.82" />
      <rect x="64" y="42" width="34" height="28" rx="8" fill="#22c55e" opacity="0.8" />
      <rect x="102" y="42" width="18" height="28" rx="8" fill="#0ea5e9" opacity="0.74" />
    </ThumbFrame>
  );
}

export function TeadsLayout1Thumb(): JSX.Element {
  return (
    <ThumbFrame background="#ffffff">
      <rect x="22" y="18" width="116" height="64" rx="14" fill="#ffffff" stroke="#dbe4ec" />
      <circle cx="36" cy="30" r="7" fill="#0f172a" opacity="0.84" />
      <rect x="48" y="24" width="42" height="6" rx="3" fill="#0f172a" opacity="0.72" />
      <rect x="30" y="40" width="100" height="22" rx="10" fill="#cbd5e1" />
      <rect x="30" y="66" width="58" height="8" rx="4" fill="#0f172a" opacity="0.22" />
      <rect x="96" y="64" width="28" height="12" rx="6" fill="#e2e8f0" />
    </ThumbFrame>
  );
}

export function TeadsLayout2Thumb(): JSX.Element {
  return (
    <ThumbFrame background="#ffffff">
      <rect x="22" y="18" width="116" height="64" rx="14" fill="#ffffff" stroke="#dbe4ec" />
      <rect x="30" y="28" width="100" height="26" rx="10" fill="#cbd5e1" />
      <rect x="30" y="58" width="100" height="14" rx="7" fill="#1877f2" />
      <rect x="42" y="62" width="34" height="6" rx="3" fill="#ffffff" opacity="0.92" />
    </ThumbFrame>
  );
}

export function MapThumb(): JSX.Element {
  return (
    <ThumbFrame background="#dbeafe">
      <rect x="20" y="18" width="120" height="64" rx="16" fill="#eff6ff" stroke="#bfdbfe" />
      <path d="M20 54H140" stroke="#93c5fd" strokeWidth="4" opacity="0.65" />
      <path d="M56 18V82" stroke="#93c5fd" strokeWidth="4" opacity="0.45" />
      <path d="M100 18V82" stroke="#93c5fd" strokeWidth="4" opacity="0.45" />
      <path d="M82 34C82 26.82 76.18 21 69 21C61.82 21 56 26.82 56 34C56 45 69 56 69 56C69 56 82 45 82 34Z" fill="#ef4444" />
      <circle cx="69" cy="34" r="4.5" fill="#ffffff" />
      <rect x="94" y="28" width="28" height="22" rx="8" fill="#22c55e" opacity="0.9" />
      <rect x="98" y="35" width="20" height="6" rx="3" fill="#ffffff" opacity="0.88" />
    </ThumbFrame>
  );
}

export function BadgeThumb(): JSX.Element {
  return (
    <ThumbFrame background="#1f2937">
      <rect x="24" y="34" width="112" height="32" rx="16" fill="#7c3aed" opacity="0.92" />
      <path d="M46 42L48.8 47.8L55 48.7L50.5 53L51.6 59L46 56L40.4 59L41.5 53L37 48.7L43.2 47.8Z" fill="#f8fafc" />
      <rect x="64" y="45" width="46" height="8" rx="4" fill="#f8fafc" opacity="0.92" />
    </ThumbFrame>
  );
}

export function GroupThumb(): JSX.Element {
  return (
    <ThumbFrame background="#241b34">
      <rect x="34" y="26" width="62" height="42" rx="12" fill="#a78bfa" opacity="0.4" stroke="#c4b5fd" strokeWidth="2" />
      <rect x="64" y="36" width="62" height="42" rx="12" fill="#f5f3ff" opacity="0.14" stroke="#e9d5ff" strokeWidth="2.5" />
    </ThumbFrame>
  );
}

export function ShapeThumb(): JSX.Element {
  return (
    <ThumbFrame background="#241b34">
      <circle cx="50" cy="50" r="16" fill="#f59e0b" />
      <rect x="68" y="32" width="26" height="26" rx="8" fill="#22c55e" />
      <path d="M110 68L94 40H126L110 68Z" fill="#a78bfa" />
    </ThumbFrame>
  );
}

export function AddToCalendarThumb(): JSX.Element {
  return (
    <ThumbFrame background="#0f172a">
      <rect x="34" y="22" width="92" height="58" rx="14" fill="#f8fafc" />
      <rect x="34" y="22" width="92" height="16" rx="14" fill="#ef4444" />
      <rect x="48" y="48" width="16" height="14" rx="4" fill="#f59e0b" />
      <rect x="72" y="48" width="14" height="4" rx="2" fill="#0f172a" opacity="0.68" />
      <rect x="72" y="56" width="24" height="4" rx="2" fill="#0f172a" opacity="0.38" />
    </ThumbFrame>
  );
}

export function ButtonsThumb(): JSX.Element {
  return (
    <ThumbFrame background="#172033">
      <rect x="24" y="40" width="42" height="18" rx="9" fill="#22c55e" />
      <rect x="72" y="40" width="42" height="18" rx="9" fill="#f8fafc" opacity="0.2" stroke="#f8fafc" strokeOpacity="0.35" />
      <rect x="120" y="40" width="18" height="18" rx="9" fill="#f59e0b" />
    </ThumbFrame>
  );
}

export function CountdownThumb(): JSX.Element {
  return (
    <ThumbFrame background="#111827">
      <rect x="26" y="28" width="32" height="42" rx="10" fill="#f59e0b" opacity="0.92" />
      <rect x="64" y="28" width="32" height="42" rx="10" fill="#f59e0b" opacity="0.92" />
      <rect x="102" y="28" width="32" height="42" rx="10" fill="#f59e0b" opacity="0.92" />
      <circle cx="61" cy="44" r="2.5" fill="#f8fafc" />
      <circle cx="61" cy="56" r="2.5" fill="#f8fafc" />
      <circle cx="99" cy="44" r="2.5" fill="#f8fafc" />
      <circle cx="99" cy="56" r="2.5" fill="#f8fafc" />
    </ThumbFrame>
  );
}

export function DragTokenPoolThumb(): JSX.Element {
  return (
    <ThumbFrame background="#172033">
      <rect x="24" y="38" width="30" height="24" rx="12" fill="#22c55e" />
      <rect x="60" y="38" width="30" height="24" rx="12" fill="#f8fafc" opacity="0.18" stroke="#f8fafc" strokeOpacity="0.3" />
      <rect x="96" y="38" width="40" height="24" rx="12" fill="#22c55e" opacity="0.72" />
    </ThumbFrame>
  );
}

export function DropZoneThumb(): JSX.Element {
  return (
    <ThumbFrame background="#172033">
      <rect x="32" y="22" width="96" height="56" rx="14" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeDasharray="7 6" />
      <path d="M80 34V56" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
      <path d="M70 48L80 58L90 48" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </ThumbFrame>
  );
}

export function FormThumb(): JSX.Element {
  return (
    <ThumbFrame background="#172033">
      <rect x="28" y="20" width="104" height="14" rx="7" fill="#f8fafc" opacity="0.16" />
      <rect x="28" y="40" width="104" height="12" rx="6" fill="#f8fafc" opacity="0.14" />
      <rect x="28" y="58" width="104" height="12" rx="6" fill="#f8fafc" opacity="0.14" />
      <rect x="52" y="76" width="56" height="10" rx="5" fill="#ec4899" />
    </ThumbFrame>
  );
}

export function FourFacesThumb(): JSX.Element {
  return (
    <ThumbFrame background="#172033">
      <rect x="28" y="20" width="42" height="24" rx="8" fill="#f59e0b" />
      <rect x="76" y="20" width="42" height="24" rx="8" fill="#22c55e" />
      <rect x="28" y="50" width="42" height="24" rx="8" fill="#f8fafc" opacity="0.16" />
      <rect x="76" y="50" width="42" height="24" rx="8" fill="#ef4444" />
      <circle cx="72" cy="84" r="3" fill="#f8fafc" />
      <circle cx="80" cy="84" r="3" fill="#f8fafc" opacity="0.42" />
      <circle cx="88" cy="84" r="3" fill="#f8fafc" opacity="0.42" />
    </ThumbFrame>
  );
}

export function GenAiImageThumb(): JSX.Element {
  return (
    <ThumbFrame background="#111827">
      <rect x="30" y="22" width="100" height="56" rx="14" fill="#22d3ee" opacity="0.16" stroke="#67e8f9" strokeWidth="1.5" />
      <path d="M54 54L74 34L90 48L106 32L126 54H54Z" fill="#f8fafc" opacity="0.85" />
      <path d="M46 34L48 38L52 40L48 42L46 46L44 42L40 40L44 38Z" fill="#f59e0b" />
      <path d="M116 24L117.5 27L121 28L117.5 29L116 32L114.5 29L111 28L114.5 27Z" fill="#f8fafc" />
    </ThumbFrame>
  );
}

export function InteractiveGalleryThumb(): JSX.Element {
  return (
    <ThumbFrame background="#172033">
      <rect x="28" y="22" width="42" height="24" rx="8" fill="#22c55e" opacity="0.92" />
      <rect x="76" y="22" width="42" height="24" rx="8" fill="#f8fafc" opacity="0.2" />
      <rect x="28" y="52" width="42" height="24" rx="8" fill="#f59e0b" opacity="0.86" />
      <rect x="76" y="52" width="42" height="24" rx="8" fill="#f8fafc" opacity="0.12" />
    </ThumbFrame>
  );
}

export function InteractiveHotspotThumb(): JSX.Element {
  return (
    <ThumbFrame background="#172033">
      <rect x="28" y="22" width="104" height="56" rx="14" fill="#f8fafc" opacity="0.12" />
      <circle cx="80" cy="50" r="16" fill="#22c55e" opacity="0.22" />
      <circle cx="80" cy="50" r="9" fill="#22c55e" />
      <path d="M80 45V55M75 50H85" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
    </ThumbFrame>
  );
}

export function InteractiveVideoThumb(): JSX.Element {
  return (
    <ThumbFrame background="#0f172a">
      <rect x="44" y="14" width="72" height="72" rx="20" fill="#020617" stroke="#38bdf8" opacity="0.38" />
      <circle cx="80" cy="50" r="16" fill="#f8fafc" opacity="0.16" />
      <path d="M74 40L92 50L74 60V40Z" fill="#f8fafc" />
      <circle cx="106" cy="30" r="6" fill="#22c55e" />
      <path d="M106 26V34M102 30H110" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
    </ThumbFrame>
  );
}

export function ParticleHaloThumb(): JSX.Element {
  return (
    <ThumbFrame background="#172033">
      <circle cx="80" cy="50" r="16" fill="#22d3ee" opacity="0.9" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, index) => {
        const radians = (angle * Math.PI) / 180;
        const x = 80 + Math.cos(radians) * 28;
        const y = 50 + Math.sin(radians) * 28;
        return <circle key={`halo-${index}`} cx={x} cy={y} r="3.5" fill="#f8fafc" opacity="0.72" />;
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
    <ThumbFrame background="#ffffff">
      <rect x="40" y="20" width="80" height="60" rx="12" fill="#ffffff" stroke="#111827" opacity="0.18" />
      {cells.map(([cx, cy], index) => (
        <rect key={`qr-${index}`} x={48 + cx * 10} y={28 + cy * 8} width="8" height="6" rx="1.5" fill="#111827" />
      ))}
      <rect x="46" y="26" width="18" height="14" rx="3" fill="none" stroke="#111827" strokeWidth="2" />
      <rect x="96" y="26" width="18" height="14" rx="3" fill="none" stroke="#111827" strokeWidth="2" />
      <rect x="46" y="58" width="18" height="14" rx="3" fill="none" stroke="#111827" strokeWidth="2" />
    </ThumbFrame>
  );
}

export function RangeSliderThumb(): JSX.Element {
  return (
    <ThumbFrame background="#172033">
      <rect x="30" y="48" width="100" height="6" rx="3" fill="#f8fafc" opacity="0.18" />
      <rect x="52" y="48" width="44" height="6" rx="3" fill="#22c55e" />
      <circle cx="52" cy="51" r="7" fill="#f8fafc" />
      <circle cx="96" cy="51" r="7" fill="#f8fafc" />
    </ThumbFrame>
  );
}

export function ScratchRevealThumb(): JSX.Element {
  return (
    <ThumbFrame background="#172033">
      <rect x="28" y="20" width="104" height="60" rx="16" fill="#f59e0b" opacity="0.82" />
      <path d="M34 30L126 72M34 42L112 78M48 24L132 62" stroke="#f8fafc" strokeWidth="4" opacity="0.42" />
      <rect x="44" y="34" width="72" height="32" rx="10" fill="#111827" opacity="0.22" />
    </ThumbFrame>
  );
}

export function ShoppableSidebarThumb(): JSX.Element {
  return (
    <ThumbFrame background="#172033">
      <rect x="20" y="20" width="72" height="60" rx="12" fill="#f59e0b" opacity="0.84" />
      <rect x="100" y="22" width="38" height="16" rx="8" fill="#f8fafc" opacity="0.18" />
      <rect x="100" y="42" width="38" height="16" rx="8" fill="#f8fafc" opacity="0.18" />
      <rect x="100" y="62" width="38" height="16" rx="8" fill="#f8fafc" opacity="0.18" />
    </ThumbFrame>
  );
}

export function SliderThumb(): JSX.Element {
  return (
    <ThumbFrame background="#172033">
      <rect x="24" y="28" width="112" height="46" rx="14" fill="#f8fafc" opacity="0.12" />
      <rect x="24" y="28" width="52" height="46" rx="14" fill="#ec4899" opacity="0.72" />
      <rect x="76" y="26" width="4" height="50" rx="2" fill="#ffffff" />
      <circle cx="78" cy="51" r="8" fill="#ffffff" opacity="0.92" />
    </ThumbFrame>
  );
}

export function SpeedTestThumb(): JSX.Element {
  return (
    <ThumbFrame background="#172033">
      <path d="M44 68A36 36 0 0 1 116 68" fill="none" stroke="#2dd4bf" strokeWidth="8" strokeLinecap="round" />
      <path d="M80 68L104 44" stroke="#f8fafc" strokeWidth="4" strokeLinecap="round" />
      <circle cx="80" cy="68" r="6" fill="#f8fafc" />
    </ThumbFrame>
  );
}

export function StepIndicatorThumb(): JSX.Element {
  return (
    <ThumbFrame background="#172033">
      <path d="M46 50H114" stroke="#f8fafc" strokeWidth="4" opacity="0.22" strokeLinecap="round" />
      <circle cx="50" cy="50" r="9" fill="#22c55e" />
      <circle cx="80" cy="50" r="9" fill="#f8fafc" opacity="0.26" />
      <circle cx="110" cy="50" r="9" fill="#f8fafc" opacity="0.26" />
    </ThumbFrame>
  );
}

export function TikTokVideoThumb(): JSX.Element {
  return (
    <ThumbFrame background="#09090b">
      <rect x="52" y="10" width="56" height="80" rx="18" fill="#111827" stroke="#1f2937" />
      <path d="M72 36L90 46L72 56V36Z" fill="#f8fafc" />
      <path d="M110 38C110 34 113 31 117 31C121 31 124 34 124 38C124 43 117 48 117 48C117 48 110 43 110 38Z" fill="#fe2c55" />
      <rect x="64" y="72" width="32" height="4" rx="2" fill="#f8fafc" opacity="0.58" />
    </ThumbFrame>
  );
}

export function TimerBarThumb(): JSX.Element {
  return (
    <ThumbFrame background="#172033">
      <rect x="28" y="46" width="104" height="10" rx="5" fill="#f8fafc" opacity="0.16" />
      <rect x="28" y="46" width="64" height="10" rx="5" fill="#22d3ee" />
    </ThumbFrame>
  );
}

export function TravelDealThumb(): JSX.Element {
  return (
    <ThumbFrame background="#eff6ff">
      <path d="M34 54L74 44L108 30L116 36L92 48L110 54L104 60L84 56L70 66L60 64L68 54L34 60Z" fill="#3b82f6" />
      <rect x="96" y="58" width="28" height="14" rx="7" fill="#f59e0b" />
      <rect x="102" y="62" width="16" height="4" rx="2" fill="#0f172a" opacity="0.78" />
    </ThumbFrame>
  );
}

export function VerticalAccordionThumb(): JSX.Element {
  return (
    <ThumbFrame background="#111827">
      <rect x="28" y="20" width="104" height="14" rx="7" fill="#1d4ed8" />
      <rect x="28" y="38" width="104" height="12" rx="6" fill="#f8fafc" opacity="0.18" />
      <rect x="28" y="54" width="104" height="24" rx="10" fill="#f59e0b" opacity="0.82" />
      <rect x="28" y="82" width="104" height="10" rx="5" fill="#f8fafc" opacity="0.14" />
    </ThumbFrame>
  );
}

export function WeatherConditionsThumb(): JSX.Element {
  return (
    <ThumbFrame background="#dbeafe">
      <circle cx="58" cy="42" r="14" fill="#fbbf24" />
      <path d="M54 64H104C111 64 116 59 116 52C116 45 110 40 103 40C101 32 94 26 86 26C76 26 68 34 68 44C60 45 54 51 54 58C54 61 55 63 58 64Z" fill="#ffffff" />
      <rect x="62" y="72" width="38" height="6" rx="3" fill="#0f172a" opacity="0.42" />
    </ThumbFrame>
  );
}
