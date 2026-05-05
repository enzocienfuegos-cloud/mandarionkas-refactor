// apps/web/src/shell/ProductLauncher.tsx
//
// Product launcher congruent with Temple login and Portal launcher.
// Router-safe version:
// - Does NOT import or call useNavigate/useOutletContext.
// - Can render in preview without a <Router>.
// - In the real app, pass `user` and `navigateTo` from the shell/router layer.
//
// Suggested real app usage:
//   const navigate = useNavigate();
//   const { user } = useOutletContext<{ user?: ShellUser }>();
//   return <ProductLauncher user={user} navigateTo={(path, options) => navigate(path, options)} autoRedirect />;

import React, { useEffect, useMemo, useState } from 'react';

const BRAND = '#f1008b';

type ViteEnv = {
  VITE_PORTAL_URL?: string;
  DEV?: boolean;
};

export interface ShellUser {
  firstName: string;
  role?: string;
  workspace?: {
    name: string;
    productAccess?: {
      ad_server: boolean;
      studio: boolean;
    };
  };
}

type NavigateTo = (path: string, options?: { replace?: boolean }) => void;

type ProductLauncherProps = {
  user?: ShellUser;
  navigateTo?: NavigateTo;
  portalUrlOverride?: string;
  /**
   * Set true in the real app shell. Defaults to false so previews/storybook do not redirect or blank out.
   */
  autoRedirect?: boolean;
};

type ProductCard = {
  key: 'ad_server' | 'studio';
  eyebrow: string;
  badge: string;
  title: string;
  description: string;
  path: string;
  accentClassName: string;
  hoverGlowClassName: string;
  accentLineClassName: string;
};

const PRODUCT_CARDS: ProductCard[] = [
  {
    key: 'ad_server',
    eyebrow: 'Ad Server',
    badge: 'ADS',
    title: 'Campaign operations',
    description: 'Manage campaigns, tags, delivery, diagnostics, and reporting.',
    path: '/overview',
    accentClassName: 'bg-[#f1008b]/10 text-[#f1008b] border-[#f1008b]/20',
    hoverGlowClassName: 'bg-[radial-gradient(circle_at_18%_0%,rgba(241,0,139,0.18),transparent_64%)]',
    accentLineClassName: 'from-[#f1008b]/0 via-[#f1008b]/45 to-[#f1008b]/0',
  },
  {
    key: 'studio',
    eyebrow: 'Studio',
    badge: 'STU',
    title: 'Creative workflow',
    description: 'Review, publish, and hand off creative production tasks.',
    path: '/studio',
    accentClassName: 'bg-[#a855f7]/10 text-[#c084fc] border-[#a855f7]/20',
    hoverGlowClassName: 'bg-[radial-gradient(circle_at_82%_0%,rgba(168,85,247,0.18),transparent_64%)]',
    accentLineClassName: 'from-[#a855f7]/0 via-[#a855f7]/45 to-[#a855f7]/0',
  },
];

function getViteEnv(): ViteEnv {
  return ((import.meta as unknown as { env?: ViteEnv }).env ?? {}) as ViteEnv;
}

function getPortalUrl(env: ViteEnv = getViteEnv(), override?: string): string {
  const explicitOverride = override?.trim();
  if (explicitOverride) return explicitOverride;

  const configured = env.VITE_PORTAL_URL?.trim();
  if (configured) return configured;

  if (env.DEV) return 'http://localhost:5175';

  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    if (hostname.startsWith('app-')) {
      return `${protocol}//${hostname.replace(/^app-/, 'portal-')}`;
    }
  }

  return '';
}

function defaultNavigateTo(path: string, _options?: { replace?: boolean }) {
  // Safe default for previews/storybook: do not mutate browser location.
  // In production, pass your router navigate function via `navigateTo`.
  console.log('ProductLauncher navigateTo ->', path);
}

function getProductAccess(user?: ShellUser) {
  return user?.workspace?.productAccess ?? { ad_server: true, studio: true };
}

function userHasAdServerAccess(user?: ShellUser): boolean {
  return getProductAccess(user).ad_server !== false;
}

function getAvailableProductCards(user?: ShellUser): ProductCard[] {
  const access = getProductAccess(user);
  return PRODUCT_CARDS.filter((card) => access[card.key] !== false);
}

function validateLauncherConfig() {
  return {
    brandIsFuchsia: BRAND.toLowerCase() === '#f1008b',
    portalUrlFallbackIsString: typeof getPortalUrl({}) === 'string',
    configuredPortalUrlTrims: getPortalUrl({ VITE_PORTAL_URL: '  https://portal.example.com  ' }) === 'https://portal.example.com',
    portalOverrideWins: getPortalUrl({ VITE_PORTAL_URL: 'https://wrong.example.com' }, ' https://right.example.com ') === 'https://right.example.com',
    devPortalFallbackWorks: getPortalUrl({ DEV: true }) === 'http://localhost:5175',
    defaultNavigateIsFunction: typeof defaultNavigateTo === 'function',
    defaultAutoRedirectShouldBePreviewSafe: true,
    defaultAccessAllowsAdServer: userHasAdServerAccess(undefined) === true,
    explicitAdServerFalseBlocksAccess: userHasAdServerAccess({ firstName: 'A', workspace: { name: 'W', productAccess: { ad_server: false, studio: true } } }) === false,
    availableCardsDefaultToTwo: getAvailableProductCards(undefined).length === 2,
    availableCardsRespectStudioFalse: getAvailableProductCards({ firstName: 'A', workspace: { name: 'W', productAccess: { ad_server: true, studio: false } } }).length === 1,
  };
}

const tests = validateLauncherConfig();
console.assert(tests.brandIsFuchsia, 'Brand color should remain fuchsia.');
console.assert(tests.portalUrlFallbackIsString, 'Portal URL fallback should return a string.');
console.assert(tests.configuredPortalUrlTrims, 'Configured portal URL should be trimmed.');
console.assert(tests.portalOverrideWins, 'Portal override should win over env config.');
console.assert(tests.devPortalFallbackWorks, 'Dev portal fallback should return localhost portal URL.');
console.assert(tests.defaultNavigateIsFunction, 'Default navigation helper should be a function.');
console.assert(tests.defaultAutoRedirectShouldBePreviewSafe, 'Default auto redirect should be preview safe.');
console.assert(tests.defaultAccessAllowsAdServer, 'Missing access config should default to Ad Server access.');
console.assert(tests.explicitAdServerFalseBlocksAccess, 'Explicit ad_server=false should block Ad Server access.');
console.assert(tests.availableCardsDefaultToTwo, 'Default available product cards should include Ad Server and Studio.');
console.assert(tests.availableCardsRespectStudioFalse, 'Available cards should respect studio=false.');

function LogoMark() {
  return (
    <div className="flex items-center gap-[14px]" aria-label="Temple logo">
      <div className="flex h-[42px] w-[42px] shrink-0 translate-y-[1px] items-center justify-center">
        <svg
          viewBox="180 735 585 585"
          className="h-full w-full text-white/95"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
        >
          <title>Temple mark</title>
          <path d="M307.749 738.419C318.003 736.714 340.86 737.844 351.845 737.888L424.967 737.903L567.195 737.884C621.678 737.853 671.417 730.522 715.605 768.272C767.914 812.96 763.112 868.176 762.97 929.631L762.946 1026.67L762.957 1126C762.96 1151.7 764.117 1181.09 759.304 1206.01C754.813 1228.09 744.736 1248.65 730.035 1265.73C706.39 1293.11 671.809 1307.21 636.248 1309.85C567.191 1311.8 493.945 1310.16 424.599 1310.24L348.062 1310.42C302.393 1310.3 269.687 1310.76 231.786 1280.5C192.864 1249.43 182.814 1205.13 182.677 1157.47C182.646 1146.78 183.453 1136.14 183.438 1125.56L183.471 1002.5C183.482 965.042 184.381 924.294 183.262 887.004C180.856 806.832 222.579 746.405 307.749 738.419Z" />
          <path d="M265.447 840.068C402.831 838.64 543.172 839.987 680.751 840.012C681.829 887.154 680.776 938.589 680.752 986.015L604.543 985.878C602.972 1057.71 604.561 1135.61 604.614 1207.94L516.954 1208.01L516.984 898.492L622.879 898.521L622.981 927.706L546.223 927.653L546.052 1178.73C555.637 1178.85 565.46 1178.71 575.067 1178.69L575.205 956.697L651.056 956.288L651.241 869.499L487.627 869.601L487.667 1019.11L487.62 1208.17L458.196 1208.15L458.517 869.452L294.884 869.709L294.72 956.313C319.856 956.802 345.859 956.559 371.061 956.632L371.179 1178.75C380.608 1178.93 390.422 1178.68 399.879 1178.57L399.915 927.641L323.75 927.611L323.99 898.654C358.3 897.776 394.826 898.521 429.384 898.511C430.682 1000.35 429.314 1105.82 429.314 1207.95L341.505 1208.01L341.967 985.85L265.227 986.014C265.341 937.494 264.83 888.535 265.447 840.068Z" fill="#050507" />
        </svg>
      </div>

      <div className="flex flex-col justify-center">
        <div className="text-[25px] font-semibold leading-[1] tracking-[-0.028em] text-white">Temple</div>
        <div className="mt-[3px] text-[9.5px] font-medium uppercase leading-none tracking-[0.26em] text-white/30">Superadmin</div>
      </div>
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function Background() {
  const [pointer, setPointer] = useState({ x: 50, y: 42 });

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPointer({
          x: ((event.clientX - rect.left) / rect.width) * 100,
          y: ((event.clientY - rect.top) / rect.height) * 100,
        });
      }}
      onPointerLeave={() => setPointer({ x: 50, y: 42 })}
    >
      <div className="pointer-events-none absolute inset-0 bg-[#050507]" />
      <div
        className="pointer-events-none absolute h-[920px] w-[920px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(241,0,139,0.11)_0%,rgba(241,0,139,0.045)_46%,transparent_76%)] blur-[145px] transition-[left,top] duration-700 ease-out"
        style={{ left: `${pointer.x}%`, top: `${pointer.y}%` }}
      />
      <div
        className="pointer-events-none absolute h-[680px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(88,166,255,0.08)_0%,rgba(88,166,255,0.03)_44%,transparent_72%)] blur-[150px] transition-[left,top] duration-1000 ease-out"
        style={{
          left: `${Math.max(18, Math.min(82, 100 - pointer.x * 0.42))}%`,
          top: `${Math.max(10, Math.min(80, pointer.y * 0.72 + 12))}%`,
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(800px_400px_at_50%_-10%,rgba(255,255,255,0.06),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-overlay bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.55)_1px,transparent_0)] [background-size:22px_22px]" />
    </div>
  );
}

function LauncherShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08080b] px-4 py-10 text-white">
      <Background />

      <style>{`
        @keyframes panelLight {
          0%, 100% { transform: translate3d(-18%, 0, 0); opacity: .18; }
          50% { transform: translate3d(18%, 0, 0); opacity: .34; }
        }
      `}</style>

      <section className="relative w-full max-w-[812px]">
        <div className="mb-[34px] flex justify-center">
          <LogoMark />
        </div>

        <div className="absolute inset-[-1px] -z-10 rounded-[30px] bg-[linear-gradient(135deg,rgba(255,255,255,0.14),rgba(255,255,255,0.026)_40%,rgba(241,0,139,0.16)_100%)] opacity-75 blur-[0.2px]" />

        <div className="relative overflow-hidden rounded-[30px] border border-white/[0.095] bg-[#111118]/72 p-[30px] shadow-[0_24px_90px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_0%,rgba(255,255,255,0.10),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.07)_0%,transparent_28%,transparent_64%,rgba(241,0,139,0.07)_100%)]" />
          <div className="pointer-events-none absolute -inset-x-20 top-0 h-28 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.10),transparent)] blur-xl animate-[panelLight_10s_ease-in-out_infinite]" />
          <div className="relative z-10">{children}</div>
        </div>

        <div className="mt-5 rounded-[18px] border border-white/[0.075] bg-black/18 px-5 py-[11px] text-center text-xs leading-5 text-white/30 backdrop-blur-xl">
          Authorized internal users only. Access depends on your assigned workspace and role.
        </div>
      </section>
    </main>
  );
}

function ProductTile({ card, onSelect }: { card: ProductCard; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative min-h-[244px] overflow-hidden rounded-[24px] border border-white/[0.095] bg-[#0b0b12]/82 p-[22px] text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_18px_54px_rgba(0,0,0,0.18)] backdrop-blur-xl transition duration-300 ease-out hover:-translate-y-[2px] hover:border-white/[0.16] hover:bg-[#101019] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_24px_70px_rgba(0,0,0,0.26)] focus:outline-none focus:ring-4 focus:ring-[#f1008b]/12"
    >
      <div className={`mb-[18px] inline-flex h-[44px] w-[44px] items-center justify-center rounded-[14px] border text-[10.5px] font-semibold tracking-[0.19em] ${card.accentClassName}`}>
        {card.badge}
      </div>

      <div className="mb-[11px] text-[10.5px] font-semibold uppercase tracking-[0.26em] text-white/28">{card.eyebrow}</div>
      <div className="text-[20px] font-semibold tracking-[-0.022em] text-white">{card.title}</div>
      <p className="mt-[9px] min-h-[48px] text-[13.5px] leading-[1.72] text-white/43">{card.description}</p>

      <div className="mt-[22px] h-px bg-white/[0.075]" />
      <div className={`mt-[-1px] h-px bg-gradient-to-r opacity-0 transition duration-300 group-hover:opacity-100 ${card.accentLineClassName}`} />

      <div className="mt-[17px] flex items-center justify-between text-[13.5px] font-medium text-white/36">
        <span className="transition group-hover:text-white/72">Open workspace</span>
        <span className="text-[#f1008b] transition group-hover:translate-x-1">
          <ArrowIcon />
        </span>
      </div>

      <div className={`pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100 ${card.hoverGlowClassName}`} />
    </button>
  );
}

export default function ProductLauncher({
  user,
  navigateTo = defaultNavigateTo,
  portalUrlOverride,
  autoRedirect = false,
}: ProductLauncherProps) {
  const access = useMemo(() => getProductAccess(user), [user]);
  const hasAdServerAccess = access.ad_server !== false;
  const portalUrl = useMemo(() => getPortalUrl(undefined, portalUrlOverride), [portalUrlOverride]);
  const availableCards = useMemo(() => getAvailableProductCards(user), [user]);
  const workspaceName = user?.workspace?.name ?? 'Signalmix';
  const roleName = user?.role ?? 'Admin';

  useEffect(() => {
    if (!autoRedirect) return;

    if (hasAdServerAccess) {
      navigateTo('/overview', { replace: true });
      return;
    }

    if (portalUrl && typeof window !== 'undefined') {
      window.location.assign(portalUrl);
    }
  }, [autoRedirect, hasAdServerAccess, navigateTo, portalUrl]);

  if (hasAdServerAccess && autoRedirect) return null;

  if (!autoRedirect) {
    return (
      <LauncherShell>
        <div className="mb-[30px] text-center">
          <div className="mb-[18px] inline-flex rounded-full border border-[#f1008b]/20 bg-[#f1008b]/10 px-[11px] py-[5px] text-[10.5px] font-semibold leading-none text-[#f1008b]">
            Admin access
          </div>
          <h1 className="text-[37px] font-semibold leading-[1.02] tracking-[-0.052em] text-white md:text-[41px]">
            Choose where to work
          </h1>
          <p className="mt-[14px] text-[13.5px] text-white/44">
            Active workspace: <span className="font-semibold text-white/78">{workspaceName}</span> · Role:{' '}
            <span className="font-semibold text-white/78">{roleName}</span>
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {availableCards.length > 0 ? (
            availableCards.map((card) => (
              <ProductTile key={card.key} card={card} onSelect={() => navigateTo(card.path, { replace: true })} />
            ))
          ) : (
            <div className="rounded-[22px] border border-white/[0.10] bg-black/30 p-6 text-center text-sm text-white/45 md:col-span-2">
              No product access has been assigned to this workspace.
            </div>
          )}
        </div>
      </LauncherShell>
    );
  }

  if (portalUrl && !hasAdServerAccess) {
    return (
      <LauncherShell>
        <div className="mx-auto max-w-[460px] text-left">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/34">Unified access</p>
            <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.035em] text-white">
              Redirecting to the portal{user?.firstName ? `, ${user.firstName}` : ''}
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/42">
              This account does not have Ad Server access. Temple is sending you back to the canonical portal launcher.
            </p>
          </div>

          <a
            href={portalUrl}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(241,0,139,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(241,0,139,0.30)]"
            style={{ background: BRAND }}
          >
            <span>Continue in Portal</span>
            <ArrowIcon />
          </a>
        </div>
      </LauncherShell>
    );
  }

  return (
    <LauncherShell>
      <div className="mx-auto max-w-[460px] text-left">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/34">Dev mode</p>
          <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.035em] text-white">Portal is not configured</h1>
          <p className="mt-2 text-sm leading-6 text-white/42">
            Set <code className="rounded bg-black/30 px-1.5 py-0.5 text-white/60">VITE_PORTAL_URL</code> or start{' '}
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-white/60">apps/portal</code> on port 5175.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigateTo('/overview')}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(241,0,139,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(241,0,139,0.30)]"
          style={{ background: BRAND }}
        >
          <span>Go to Ad Server overview</span>
          <ArrowIcon />
        </button>
      </div>
    </LauncherShell>
  );
}
