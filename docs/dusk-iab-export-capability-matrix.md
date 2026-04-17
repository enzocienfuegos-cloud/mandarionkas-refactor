# Dusk IAB Export Capability Matrix v1

This document defines the first implementation contract for Dusk's IAB-oriented export pipeline.

It is intentionally policy-driven:

- no widget should hardcode channel behavior
- no export path should assume a single CTA
- complex modules must declare degradations instead of pretending full compliance
- quality should be selected by export profile, not buried inside widget renderers

This is the first planning artifact for the IAB export workstream, not the final compliance report.

## Goals

- Export banners from Dusk using an IAB-first pipeline.
- Support multiple exits/CTAs in the same creative.
- Keep the export engine decoupled from editor-only runtime behavior.
- Allow modules to opt into `supported`, `degraded`, or `unsupported` export modes.
- Provide configurable quality profiles without hardcoded limits.

## Non-Goals

- Google-specific packaging, clickTag syntax, or ad server adapters.
- Pretending all interactive modules are fully portable to IAB HTML5.
- Embedding channel logic inside widget definitions.

## Export Principles

- `Neutral package first`: Dusk should build a neutral IAB-oriented package before any platform-specific adapter exists.
- `Capabilities over assumptions`: every widget/module declares what it can export and under which restrictions.
- `Graceful degradation`: unsupported or risky modules should downgrade cleanly when possible.
- `Multi-exit by design`: exits are first-class export entities, not side effects of one CTA button.
- `Quality is a policy`: asset fidelity is chosen by export profile, not by hardcoded widget rules.

## Core Export Concepts

### Capability statuses

- `supported`: module can export with behavior and semantics preserved.
- `degraded`: module exports in a simplified form that preserves layout/value but not full behavior.
- `unsupported`: module is excluded from IAB export and must raise a readiness warning or blocker.

### Export profiles

- `high`: preserves maximum visual fidelity, higher-resolution assets, minimal compression.
- `medium`: balances fidelity and package size.
- `low`: favors smaller assets and simpler media delivery.

Profiles are selected by export policy. Widgets expose source assets; the asset pipeline decides which derived asset variant to package.

### Exit model

Dusk export must support `0..n` exits:

- each exit maps to a widget or hotspot
- each exit has a stable `id`
- each exit has a human-readable `label`
- each exit resolves its URL from bindings or configured values
- each exit declares interaction type such as `click`, `tap`, or `hotspot`
- each exit stores bounds and source widget references for packaging/runtime

Suggested neutral shape:

```ts
type ExportExit = {
  id: string;
  label: string;
  sourceWidgetId: string;
  trigger: 'click' | 'tap';
  bounds: { x: number; y: number; width: number; height: number };
  urlBinding?: string;
  fallbackUrl?: string;
  metadata?: Record<string, string>;
};
```

### Capability contract

Each widget/module should eventually resolve into a neutral export capability record like:

```ts
type ExportCapability = {
  widgetType: string;
  status: 'supported' | 'degraded' | 'unsupported';
  exportKind: 'dom' | 'media' | 'hotspot' | 'snapshot' | 'omit';
  supportsMultipleExits: boolean;
  requiresUserInitiation?: boolean;
  needsFallbackAsset?: boolean;
  externalRuntimeRisk?: 'none' | 'low' | 'medium' | 'high';
  degradationStrategy?: 'snapshot' | 'static-dom' | 'flatten-to-image' | 'omit';
  notes?: string[];
};
```

## Capability Matrix

### Tier A: Should be supported in v1

| Widget/module | Status | Export kind | Exit support | Degradation | Notes |
| --- | --- | --- | --- | --- | --- |
| `text` | supported | `dom` | none | none | Safe baseline DOM export. |
| `shape` | supported | `dom` | none | none | Safe for layout/background primitives. |
| `cta` | supported | `dom` + `hotspot` | multiple | none | Must map to neutral exits, not hardcoded one-button logic. |
| `buttons` | supported | `dom` + `hotspot` | multiple | none | Each rendered button may generate its own exit. |
| `image` | supported | `media` | optional overlay exit | none | Export real image asset, not placeholder text. |
| `hero-image` | supported | `media` | optional overlay exit | none | Same as image with focal-point aware rendering. |
| `badge` | supported | `dom` | optional | static-dom | Export as styled DOM, not editor placeholder. |
| `qr-code` | supported | `media` or `dom` | optional | flatten-to-image | Prefer deterministic image/SVG generation. |
| `group` | supported | composition | inherited | flatten children only | Container should not own behavior; children determine export semantics. |

### Tier B: Support with stricter rules

| Widget/module | Status | Export kind | Exit support | Degradation | Notes |
| --- | --- | --- | --- | --- | --- |
| `video-hero` | degraded in v1, supported in v2 | `media` | optional overlay exit | poster/snapshot fallback | Should not block v1. Needs playback policy and fallback strategy. |
| `countdown` | degraded | `dom` | optional | static-dom | Dynamic countdown logic may need export-time freezing in v1. |
| `slider` | degraded | `dom` | multiple | snapshot or first-state export | Full interactive behavior is riskier than value delivered. |
| `range-slider` | degraded | `dom` | multiple | static-dom | Preserve current value visually before full interactivity support. |
| `image-carousel` | degraded | `media` | multiple | first-slide or timed snapshot | Avoid complex runtime until engine matures. |
| `interactive-hotspot` | supported | `hotspot` | multiple | none | Good fit if hotspots export as neutral exits over layout/media. |
| `scratch-reveal` | degraded | `snapshot` | optional | flatten-to-image | Full canvas interaction is likely non-trivial for v1. |
| `interactive-gallery` | degraded | `snapshot` or simplified DOM | multiple | first-panel export | Rich state machine should not be assumed compliant by default. |

### Tier C: Default to degraded or unsupported until proven safe

| Widget/module | Status | Export kind | Exit support | Degradation | Notes |
| --- | --- | --- | --- | --- | --- |
| `dynamic-map` | unsupported in v1 | `omit` or `snapshot` | optional overlay exit | flatten-to-image | External map runtimes and live tiles are high-risk. |
| `weather-conditions` | degraded | `dom` | optional | resolved static data | Export frozen resolved state, not live fetch behavior. |
| `travel-deal` | degraded | `dom` | multiple | static-dom | Export current resolved offer state only. |
| `shoppable-sidebar` | degraded | `dom` | multiple | static list/cards | Full commerce behavior should be simplified first. |
| `form` | unsupported in v1 | `omit` or `snapshot` | optional CTA replacement | static lead CTA | Form submission introduces behavior/compliance complexity. |
| `speed-test` | unsupported in v1 | `omit` or `snapshot` | optional CTA | flatten-to-image | Requires runtime/network behavior not suitable for first IAB pass. |
| `add-to-calendar` | degraded | `dom` | single or multiple | CTA-only | Export as one or more exits, not calendar logic. |
| `gen-ai-image` | degraded | `media` | optional | flatten-to-image | Export generated asset result only, never generation behavior. |

## Current Dusk Gap vs Target

Today Dusk's export flow is not yet aligned with this model:

- current export emits standalone preview HTML and JSON packages
- current export does not serialize exits as a neutral first-class model
- current export does not package assets as a production bundle
- several widgets still export placeholders instead of real media/runtime-safe markup
- current validations are heuristics, not capability-driven readiness rules

## Recommended Engine Shape

### 1. Export model layer

Transform editor state into a neutral export graph:

- scenes
- positioned nodes
- resolved assets
- resolved exits
- capability results
- degradation decisions

### 2. Capability resolver

For each widget:

- read widget type
- inspect props/style/actions
- determine `supported`, `degraded`, or `unsupported`
- generate export notes and blockers

This layer should be pure and testable.

### 3. Asset pipeline

The asset pipeline should:

- collect all referenced media
- derive quality variants by profile
- preserve original source references
- return chosen packaged assets without hardcoded size thresholds

Suggested neutral policy shape:

```ts
type ExportQualityProfile = {
  id: 'high' | 'medium' | 'low';
  image: {
    maxScaleMultiplier?: number;
    preferredFormats: Array<'png' | 'jpeg' | 'webp' | 'svg'>;
    compressionBias: 'quality' | 'balanced' | 'size';
  };
  video: {
    allowVideo: boolean;
    preferPosterFallback: boolean;
  };
};
```

### 4. Package builder

Neutral package output should eventually look like:

- `index.html`
- `styles.css`
- `runtime.js`
- `manifest.json`
- `assets/*`

This should be generated from the export model, not directly from UI store assumptions.

## Multi-CTA Rules

Dusk must support more than one CTA without special cases.

Required rules:

- a creative may expose multiple exits
- CTA-like widgets do not own the export click model exclusively
- image, hotspot, badge, or other modules may also generate exits
- duplicate URLs are allowed, but distinct exits still need distinct IDs and labels
- no single `primaryCTA` should be assumed in the engine core

## Degradation Rules

When a module is not safe for first-pass IAB export:

- preserve layout if possible
- preserve user intent if possible
- replace behavior with static state when needed
- replace external/live functionality with frozen resolved output
- raise explicit readiness notes when parity is not preserved

Examples:

- `dynamic-map` -> export current visual snapshot plus optional CTA overlay
- `form` -> replace with lead CTA card or mark unsupported
- `weather-conditions` -> export resolved weather state only
- `video-hero` -> export poster-only in `low`, poster or video in `medium/high` depending on policy

## Readiness Output

Readiness should move from generic checks to capability-aware checks.

Required output categories:

- `blocker`
- `warning`
- `info`

Examples:

- blocker: unsupported module present with no valid degradation
- warning: module exported as snapshot, interactivity lost
- warning: video downgraded to poster in selected quality profile
- info: multiple exits generated from one composite module

## Sprint Recommendation

### Sprint 1

- define neutral export types
- define capability resolver
- define exit model
- define quality profile policy
- implement capability matrix as code/config

### Sprint 2

- build export model layer
- support Tier A widgets
- emit multi-exit manifest
- emit real packaged media for image/hero/QR

### Sprint 3

- add Tier B degradations
- wire capability-aware readiness
- add test fixtures for mixed creatives

Current status:

- largely complete in runtime scope
- readiness is now capability-aware
- target coverage is surfaced in model, manifest and UI
- asset packaging risk is surfaced in model, manifest and UI
- remaining work is mostly hardening, fixtures and explicit decisions for degraded modules

### Sprint 4

- decide which Tier C modules graduate, degrade, or remain unsupported
- document exact compliance caveats per module

Expanded start point:

- add export fixtures for multi-scene and multi-target creatives
- harden unresolved asset diagnostics
- formalize graduation/degradation for `video-hero`, `image-carousel`, `group` and richer modules
- document exact runtime caveats per module and interaction type

## Immediate Implementation Decisions

These decisions should guide the next code changes:

- `cta`, `buttons`, `interactive-hotspot`, `image`, `hero-image`, `text`, `shape`, and `badge` should anchor v1.
- `dynamic-map`, `form`, and `speed-test` should not block the engine design; they should start as unsupported or degraded.
- `video-hero` should not define v1 architecture; support it through policy-driven fallback.
- quality handling should live in the asset pipeline, not in widget renderers.
- channel-specific adapters should be added later on top of the neutral IAB package.

## Open Questions

- Which interactive modules are business-critical enough to graduate from degraded to supported in v1?
- Should `video-hero` be allowed in `high` and `medium` only, with forced poster fallback in `low`?
- Should `form` export as unsupported, or as a policy-controlled CTA replacement?
- Do we want export-time raster snapshots for complex modules generated in-browser, or produced by a server-side packaging step later?
